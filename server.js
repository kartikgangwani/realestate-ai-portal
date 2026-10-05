'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const { Pool } = require('pg');
const { createIntegrations } = require('./integrations');
const { createLeadIngest } = require('./integrations/lead-ingest');
const { parseLeadEmail } = require('./integrations/lead-parser');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const SCHEMA_FILE = path.join(ROOT, 'db', 'schema.sql');
const SEED_FILE = path.join(ROOT, 'seed-state.json');
const PORT = Number(process.env.PORT || 3000);
const APP_MODE = process.env.APP_MODE || 'TEST';
const DATABASE_URL = process.env.DATABASE_URL;
const SESSION_SECRET = process.env.SESSION_SECRET;
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const SESSION_SECONDS = 8 * 60 * 60;
const MAX_JSON_BYTES = 1024 * 1024;
const loginAttempts = new Map();

if (APP_MODE !== 'TEST' && APP_MODE !== 'LIVE') {
  throw new Error('APP_MODE must be TEST or LIVE.');
}
// LIVE mode additional requirements are enforced in integrations/config.js (ALLOW_LIVE flag).
if (!DATABASE_URL || !SESSION_SECRET || !ADMIN_USERNAME || !ADMIN_PASSWORD) {
  throw new Error('Missing required environment variables. Copy .env.example and set DATABASE_URL, SESSION_SECRET, ADMIN_USERNAME, and ADMIN_PASSWORD.');
}
if (SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET must be at least 32 characters.');
}
if (!/^[a-zA-Z0-9._-]{3,64}$/.test(ADMIN_USERNAME)) {
  throw new Error('ADMIN_USERNAME may contain only letters, numbers, dot, underscore, and hyphen.');
}
if (ADMIN_PASSWORD.length < 14) {
  throw new Error('ADMIN_PASSWORD must be at least 14 characters.');
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : false,
  max: 5,
  idleTimeoutMillis: 30000
});

// Outbound messaging layer (WhatsApp Cloud API + Instagram Messaging + LLM).
// In TEST mode it never touches the network; in LIVE mode it always requires human approval.
const integrations = createIntegrations({ pool });
const leadIngest = createLeadIngest({ pool, safety: integrations.safety });
const LEAD_INGEST_TOKEN = process.env.LEAD_INGEST_TOKEN || '';

// Raw body reader — webhook signature verification needs the exact bytes Meta signed.
function readRaw(request) {
  return new Promise(function (resolve, reject) {
    let size = 0;
    let buffer = '';
    request.setEncoding('utf8');
    request.on('data', function (chunk) {
      size += Buffer.byteLength(chunk);
      if (size > MAX_JSON_BYTES) {
        reject(new Error('Request body is too large.'));
        request.destroy();
        return;
      }
      buffer += chunk;
    });
    request.on('end', function () { resolve(buffer); });
    request.on('error', reject);
  });
}

function nowPlusSeconds(seconds) {
  return new Date(Date.now() + seconds * 1000);
}

function randomToken(bytes) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function tokenHash(token) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(token).digest('hex');
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function scrypt(password, salt) {
  return new Promise(function (resolve, reject) {
    crypto.scrypt(password, salt, 64, function (error, derivedKey) {
      if (error) reject(error);
      else resolve(derivedKey.toString('hex'));
    });
  });
}

async function hashPassword(password) {
  const salt = randomToken(16);
  const hash = await scrypt(password, salt);
  return salt + ':' + hash;
}

async function verifyPassword(password, stored) {
  const pieces = String(stored || '').split(':');
  if (pieces.length !== 2) return false;
  const actual = await scrypt(password, pieces[0]);
  return safeEqual(actual, pieces[1]);
}

function parseCookies(request) {
  const result = {};
  String(request.headers.cookie || '').split(';').forEach(function (part) {
    const index = part.indexOf('=');
    if (index > 0) result[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  });
  return result;
}

function securityHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  response.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; object-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; manifest-src 'none'");
  response.setHeader('Cache-Control', 'no-store');
}

function sendJson(response, status, value, extraHeaders) {
  securityHeaders(response);
  response.writeHead(status, Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, extraHeaders || {}));
  response.end(JSON.stringify(value));
}

function sendText(response, status, message) {
  securityHeaders(response);
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end(message);
}

function getContentType(filename) {
  const extension = path.extname(filename).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.svg': 'image/svg+xml'
  }[extension] || 'application/octet-stream';
}

function readJson(request, maxBytes) {
  return new Promise(function (resolve, reject) {
    const limit = Number(maxBytes) || MAX_JSON_BYTES;
    let size = 0;
    let buffer = '';
    request.setEncoding('utf8');
    request.on('data', function (chunk) {
      size += Buffer.byteLength(chunk);
      if (size > limit) {
        reject(new Error('Request body is too large.'));
        request.destroy();
        return;
      }
      buffer += chunk;
    });
    request.on('end', function () {
      if (!buffer) return resolve({});
      try {
        resolve(JSON.parse(buffer));
      } catch (error) {
        reject(new Error('Request body must be valid JSON.'));
      }
    });
    request.on('error', reject);
  });
}

function getClientIp(request) {
  return String(request.socket.remoteAddress || 'unknown');
}

function canAttemptLogin(ip) {
  const now = Date.now();
  const prior = loginAttempts.get(ip) || [];
  const recent = prior.filter(function (entry) { return now - entry < LOGIN_WINDOW_MS; });
  loginAttempts.set(ip, recent);
  return recent.length < 10;
}

function recordFailedLogin(ip) {
  const now = Date.now();
  const prior = loginAttempts.get(ip) || [];
  loginAttempts.set(ip, prior.concat([now]).filter(function (entry) { return now - entry < LOGIN_WINDOW_MS; }));
}

function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}


// ── Property media (photos + location pin) ───────────────────────────────────
const PHOTO_MAX_JSON_BYTES = 9 * 1024 * 1024; // base64 body (≈6.5 MB image)
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;      // decoded image cap
const MAX_PHOTOS_PER_PROPERTY = 12;
const MEDIA_ID_PATTERN = /^m_[a-f0-9]{24}$/;

function nextPropertyId(properties) {
  let max = 100;
  (properties || []).forEach(function (property) {
    const match = String(property.id || '').match(/^P-(\d+)$/);
    if (match) max = Math.max(max, Number(match[1]));
  });
  return 'P-' + (max + 1);
}

function cleanGeoInput(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'object') return null;
  const lat = Number(value.lat);
  const lng = Number(value.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return {
    lat: Math.round(lat * 1e6) / 1e6,
    lng: Math.round(lng * 1e6) / 1e6,
    label: String(value.label || '').slice(0, 120),
    area: String(value.area || '').slice(0, 200),
    mapsUrl: String(value.mapsUrl || '').slice(0, 500) || `https://www.google.com/maps?q=${lat},${lng}`
  };
}

// Validate + normalise a property payload coming from the portal form.
function normalizePropertyInput(body, existing) {
  const name = String(body.name || '').trim().slice(0, 80);
  if (!name) throw new Error('Property ka naam likhna zaroori hai.');
  const price = Number(body.price);
  if (!Number.isFinite(price) || price < 0) throw new Error('Price sahi number me likho.');
  const type = ['Flat', 'Villa', 'Plot', 'Commercial', 'Land'].includes(body.type) ? body.type : 'Flat';
  const status = ['Available', 'On Hold', 'Sold'].includes(body.status) ? body.status : 'Available';
  return {
    id: existing ? existing.id : null,
    name,
    type,
    location: String(body.location || '').trim().slice(0, 80) || 'Location not set',
    price,
    status,
    detail: String(body.detail || '').trim().slice(0, 140),
    geo: cleanGeoInput(body.geo),
    photos: existing && Array.isArray(existing.photos) ? existing.photos : []
  };
}

function escapeHtmlServer(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatInrForPage(value) {
  const number = Number(value) || 0;
  if (number >= 10000000) return '₹' + (number / 10000000).toFixed(2).replace(/\.00$/, '') + ' Cr';
  if (number >= 100000) return '₹' + (number / 100000).toFixed(2).replace(/\.00$/, '') + ' Lakh';
  return '₹' + number.toLocaleString('en-IN');
}

// Public, login-free property page (share this link with a client on WhatsApp).
function renderPropertyPage(property, baseUrl) {
  const photos = Array.isArray(property.photos) ? property.photos : [];
  const geo = property.geo && Number.isFinite(Number(property.geo.lat)) ? property.geo : null;
  const mapSrc = geo ? `https://www.google.com/maps?q=${encodeURIComponent(geo.lat + ',' + geo.lng)}&z=15&output=embed` : '';
  const mapsLink = geo ? (geo.mapsUrl || `https://www.google.com/maps?q=${geo.lat},${geo.lng}`) : '';
  const contact = String(process.env.PUBLIC_CONTACT_WHATSAPP || '').replace(/[^0-9]/g, '');
  const gallery = photos.length
    ? photos.map(function (photo, index) {
        return `<a class="shot" href="/media/${escapeHtmlServer(photo.id)}" target="_blank" rel="noopener"><img src="/media/${escapeHtmlServer(photo.id)}" alt="${escapeHtmlServer(property.name)} photo ${index + 1}" loading="lazy"></a>`;
      }).join('')
    : '<p class="mut">Photos abhi add nahi hui hain.</p>';
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapeHtmlServer(property.name)} — Property details</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #f6f8fc; color: #14213d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  .wrap { max-width: 980px; margin: 0 auto; padding: 20px 16px 60px; }
  .brand { font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
  h1 { font-size: 26px; margin: 0 0 6px; }
  .sub { color: #475569; margin: 0 0 18px; }
  .gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; margin-bottom: 22px; }
  .shot { display: block; border-radius: 14px; overflow: hidden; background: #e2e8f0; aspect-ratio: 4/3; box-shadow: 0 8px 24px rgba(15,23,42,.10); }
  .shot img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 22px; }
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 12px 14px; }
  .card span { display: block; font-size: 11px; color: #64748b; margin-bottom: 4px; }
  .card strong { font-size: 15px; }
  .map { border: 0; width: 100%; height: 320px; border-radius: 14px; background: #e2e8f0; }
  .btn { display: inline-block; margin-top: 16px; background: #16a34a; color: #fff; text-decoration: none; font-weight: 700; padding: 13px 18px; border-radius: 12px; }
  .btn.alt { background: #1d4ed8; margin-left: 8px; }
  .foot { margin-top: 26px; color: #64748b; font-size: 12px; line-height: 1.6; }
  .mut { color: #64748b; }
</style></head>
<body><div class="wrap">
  <p class="brand">Property details</p>
  <h1>${escapeHtmlServer(property.name)}</h1>
  <p class="sub">${escapeHtmlServer(property.type)} · ${escapeHtmlServer(property.location)}${property.detail ? ' · ' + escapeHtmlServer(property.detail) : ''}</p>
  <div class="gallery">${gallery}</div>
  <div class="cards">
    <div class="card"><span>Price</span><strong>${escapeHtmlServer(formatInrForPage(property.price))}</strong></div>
    <div class="card"><span>Type</span><strong>${escapeHtmlServer(property.type)}</strong></div>
    <div class="card"><span>Location</span><strong>${escapeHtmlServer(property.location)}</strong></div>
    <div class="card"><span>Status</span><strong>${escapeHtmlServer(property.status)}</strong></div>
  </div>
  ${mapSrc ? `<iframe class="map" src="${mapSrc}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Property location map"></iframe>` : ''}
  ${contact ? `<a class="btn" href="https://wa.me/${contact}?text=${encodeURIComponent('Hi, mujhe ' + property.name + ' ke baare me jaankari chahiye.')}">WhatsApp par baat karein</a>` : ''}
  ${mapsLink ? `<a class="btn alt" href="${escapeHtmlServer(mapsLink)}" target="_blank" rel="noopener">Google Maps me kholo</a>` : ''}
  <p class="foot">Ye page sirf property ki photos aur location share karne ke liye hai. Prices aur availability confirm karne ke liye sampark karein.<br>${escapeHtmlServer(baseUrl || '')}</p>
</div></body></html>`;
}

function assertTestOnlyState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('State payload is invalid.');
  const requiredArrays = ['leads', 'properties', 'followups', 'visits', 'agents', 'activities'];
  requiredArrays.forEach(function (key) {
    if (!Array.isArray(value[key])) throw new Error('State is missing ' + key + '.');
  });
  if (value.leads.length > 500 || value.properties.length > 500 || value.activities.length > 1000) {
    throw new Error('Test Mode record limit exceeded.');
  }
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized, 'utf8') > MAX_JSON_BYTES) throw new Error('State payload is too large.');
  const blockedKeys = /^(phone|mobile|email|address|api_?key|secret|access_?token|webhook)$/i;
  function inspect(item) {
    if (!item || typeof item !== 'object') return;
    Object.keys(item).forEach(function (key) {
      if (blockedKeys.test(key)) throw new Error('Test Mode does not accept real contact details or integration credentials.');
      inspect(item[key]);
    });
  }
  inspect(value);
  return JSON.parse(serialized);
}

function readSeedState() {
  const state = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'));
  return assertTestOnlyState(state);
}

async function getState() {
  const result = await pool.query('SELECT state FROM app_state WHERE singleton = TRUE');
  if (result.rowCount) return result.rows[0].state;
  const seed = readSeedState();
  await pool.query('INSERT INTO app_state (singleton, state) VALUES (TRUE, $1::jsonb)', [JSON.stringify(seed)]);
  return seed;
}

async function setState(state, userId) {
  const clean = assertTestOnlyState(state);
  await pool.query(
    'INSERT INTO app_state (singleton, state, updated_at, updated_by) VALUES (TRUE, $1::jsonb, NOW(), $2) ON CONFLICT (singleton) DO UPDATE SET state = EXCLUDED.state, updated_at = NOW(), updated_by = EXCLUDED.updated_by',
    [JSON.stringify(clean), userId]
  );
  return clean;
}

async function ensureBootstrap() {
  await pool.query(fs.readFileSync(SCHEMA_FILE, 'utf8'));
  await pool.query('DELETE FROM app_sessions WHERE expires_at <= NOW()');
  const result = await pool.query('SELECT id FROM app_users WHERE username = $1', [ADMIN_USERNAME]);
  if (!result.rowCount) {
    const passwordHash = await hashPassword(ADMIN_PASSWORD);
    await pool.query('INSERT INTO app_users (username, password_hash) VALUES ($1, $2)', [ADMIN_USERNAME, passwordHash]);
    console.log('Created the initial TEST admin account.');
  }
  await getState();
}

async function getSession(request) {
  const sessionId = parseCookies(request).reai_sid;
  if (!sessionId) return null;
  const result = await pool.query(
    'SELECT s.token_hash, s.csrf_token, u.id AS user_id, u.username FROM app_sessions s JOIN app_users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > NOW()',
    [tokenHash(sessionId)]
  );
  if (!result.rowCount) return null;
  return result.rows[0];
}

async function requireSession(request, response, requireCsrf) {
  const session = await getSession(request);
  if (!session) {
    sendJson(response, 401, { error: 'Please sign in.' });
    return null;
  }
  if (requireCsrf && !safeEqual(request.headers['x-csrf-token'], session.csrf_token)) {
    sendJson(response, 403, { error: 'Security check failed. Refresh and sign in again.' });
    return null;
  }
  return session;
}

function sessionCookie(sessionId) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return 'reai_sid=' + encodeURIComponent(sessionId) + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + SESSION_SECONDS + secure;
}

function clearSessionCookie() {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return 'reai_sid=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0' + secure;
}

async function createSession(userId) {
  const id = randomToken(32);
  const csrf = crypto.randomBytes(32).toString('hex');
  await pool.query(
    'INSERT INTO app_sessions (token_hash, user_id, csrf_token, expires_at) VALUES ($1, $2, $3, $4)',
    [tokenHash(id), userId, csrf, nowPlusSeconds(SESSION_SECONDS)]
  );
  return { id: id, csrf: csrf };
}

async function handleApi(request, response, url) {
  const pathname = url.pathname;
  if (request.method === 'GET' && pathname === '/api/health') {
    await pool.query('SELECT 1');
    sendJson(response, 200, { status: 'ok', mode: APP_MODE });
    return;
  }

  // ── Public webhook endpoints (Meta calls these; signature-verified, no session) ──
  if (pathname === '/api/webhooks/whatsapp' || pathname === '/api/webhooks/instagram') {
    await handleWebhook(request, response, url);
    return;
  }
  if (request.method === 'POST' && pathname === '/api/auth/login') {
    const ip = getClientIp(request);
    if (!canAttemptLogin(ip)) {
      sendJson(response, 429, { error: 'Too many sign-in attempts. Try again later.' });
      return;
    }
    const body = await readJson(request);
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const userResult = await pool.query('SELECT id, username, password_hash FROM app_users WHERE username = $1', [username]);
    const user = userResult.rows[0];
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      recordFailedLogin(ip);
      sendJson(response, 401, { error: 'Invalid username or password.' });
      return;
    }
    clearLoginAttempts(ip);
    const newSession = await createSession(user.id);
    sendJson(response, 200, { authenticated: true, username: user.username, csrf: newSession.csrf, state: await getState(), mode: 'TEST' }, { 'Set-Cookie': sessionCookie(newSession.id) });
    return;
  }
  if (request.method === 'GET' && pathname === '/api/session') {
    const session = await requireSession(request, response, false);
    if (!session) return;
    sendJson(response, 200, { authenticated: true, username: session.username, csrf: session.csrf_token, state: await getState(), mode: 'TEST' });
    return;
  }
  if (request.method === 'POST' && pathname === '/api/auth/logout') {
    const session = await requireSession(request, response, true);
    if (!session) return;
    await pool.query('DELETE FROM app_sessions WHERE token_hash = $1', [session.token_hash]);
    sendJson(response, 200, { loggedOut: true }, { 'Set-Cookie': clearSessionCookie() });
    return;
  }
  if (request.method === 'PUT' && pathname === '/api/state') {
    const session = await requireSession(request, response, true);
    if (!session) return;
    const body = await readJson(request);
    try {
      const saved = await setState(body.state, session.user_id);
      sendJson(response, 200, { saved: true, state: saved });
    } catch (error) {
      // Test Mode validation errors are client errors, not server crashes.
      sendJson(response, 400, { error: error.message });
    }
    return;
  }
  if (request.method === 'POST' && pathname === '/api/reset') {
    const session = await requireSession(request, response, true);
    if (!session) return;
    const saved = await setState(readSeedState(), session.user_id);
    sendJson(response, 200, { reset: true, state: saved });
    return;
  }

  // ── Lead ingest: portal emails / webhooks post here (token auth, no session) ──
  if (request.method === 'POST' && pathname === '/api/leads/ingest') {
    if (!LEAD_INGEST_TOKEN) {
      sendJson(response, 503, { error: 'Lead ingest is disabled. Set LEAD_INGEST_TOKEN to enable it.' });
      return;
    }
    const provided = String(request.headers['x-ingest-token'] || '');
    if (!safeEqual(provided, LEAD_INGEST_TOKEN)) {
      sendJson(response, 401, { error: 'Invalid ingest token.' });
      return;
    }
    const body = await readJson(request);
    try {
      let result;
      if (body && body.email) {
        result = await leadIngest.ingestRaw(body.email, { sourceHint: body.source, autoDraft: false });
      } else if (body && body.lead) {
        result = await leadIngest.ingest(body.lead, { sourceHint: body.source, createdBy: 'webhook' });
      } else {
        // accept a bare parsed object too
        result = await leadIngest.ingest(body, { createdBy: 'webhook' });
      }
      sendJson(response, result.status === 'accepted' ? 201 : 200, result);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return;
  }

  // ── Lead ingest from the UI (session + CSRF; the token route above is for machines) ──
  if (request.method === 'POST' && pathname === '/api/leads/ingest-session') {
    const session = await requireSession(request, response, true);
    if (!session) return;
    const body = await readJson(request);
    try {
      const result = await leadIngest.ingestRaw(body.email || {}, { createdBy: session.username });
      sendJson(response, result.status === 'accepted' ? 201 : 200, result);
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return;
  }

  // ── Lead parse preview (session, for testing email formats in the UI) ──
  if (request.method === 'POST' && pathname === '/api/leads/parse') {
    const session = await requireSession(request, response, true);
    if (!session) return;
    const body = await readJson(request);
    const parsed = parseLeadEmail(body.email || {});
    sendJson(response, 200, { parsed });
    return;
  }

  // ── Ingest log ──
  if (request.method === 'GET' && pathname === '/api/leads/ingest-log') {
    const session = await requireSession(request, response, false);
    if (!session) return;
    const rows = await leadIngest.list(30);
    sendJson(response, 200, { ingestEnabled: !!LEAD_INGEST_TOKEN, rows });
    return;
  }

  // ── Integration status ──
  if (request.method === 'GET' && pathname === '/api/integrations/status') {
    const session = await requireSession(request, response, false);
    if (!session) return;
    sendJson(response, 200, integrations.status());
    return;
  }

  // ── Contacts: link a real handle + record consent (required before any send) ──
  if (request.method === 'POST' && pathname === '/api/contacts') {
    const session = await requireSession(request, response, true);
    if (!session) return;
    const body = await readJson(request);
    if (!body.leadId || !body.channel || !body.handle) {
      sendJson(response, 400, { error: 'leadId, channel and handle are required.' });
      return;
    }
    if (!['whatsapp', 'instagram'].includes(body.channel)) {
      sendJson(response, 400, { error: 'channel must be whatsapp or instagram.' });
      return;
    }
    try {
      const contact = await integrations.outbox.upsertContact({
        leadId: String(body.leadId), channel: body.channel,
        handle: String(body.handle), consentSource: body.consentSource
      });
      sendJson(response, 201, { saved: true, contact: { ...contact, handle: integrations.safety.redact(contact.handle) } });
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return;
  }


  // ── Properties: create / update (portal form; session + CSRF) ──
  if (request.method === 'POST' && pathname === '/api/properties') {
    const session = await requireSession(request, response, true);
    if (!session) return;
    const body = await readJson(request);
    try {
      const state = await getState();
      const input = normalizePropertyInput(body, null);
      input.id = nextPropertyId(state.properties);
      state.properties.push(input);
      const saved = await setState(state, session.user_id);
      sendJson(response, 201, { saved: true, property: saved.properties.find(function (p) { return p.id === input.id; }) });
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return;
  }

  const propertyMatch = pathname.match(/^\/api\/properties\/([A-Za-z0-9-]+)$/);
  if (request.method === 'PUT' && propertyMatch) {
    const session = await requireSession(request, response, true);
    if (!session) return;
    const body = await readJson(request);
    try {
      const state = await getState();
      const index = state.properties.findIndex(function (entry) { return entry.id === propertyMatch[1]; });
      if (index < 0) { sendJson(response, 404, { error: 'Property not found.' }); return; }
      const input = normalizePropertyInput(body, state.properties[index]);
      state.properties[index] = Object.assign({}, state.properties[index], input);
      const saved = await setState(state, session.user_id);
      sendJson(response, 200, { saved: true, property: saved.properties[index] });
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return;
  }

  // ── Property photos: upload (base64 JSON), delete ──
  const photoMatch = pathname.match(/^\/api\/properties\/([A-Za-z0-9-]+)\/photos$/);
  if (request.method === 'POST' && photoMatch) {
    const session = await requireSession(request, response, true);
    if (!session) return;
    const body = await readJson(request, PHOTO_MAX_JSON_BYTES);
    try {
      const match = /^data:(image\/(?:png|jpeg|jpg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.dataUrl || ''));
      if (!match) { sendJson(response, 400, { error: 'Sirf JPG / PNG / WEBP photo chalegi.' }); return; }
      const mime = match[1] === 'image/jpg' ? 'image/jpeg' : match[1];
      const bytes = Buffer.from(match[2], 'base64');
      if (!bytes.length || bytes.length > PHOTO_MAX_BYTES) { sendJson(response, 400, { error: 'Photo 5 MB se badi hai — chhoti photo chuno.' }); return; }
      const state = await getState();
      const property = state.properties.find(function (entry) { return entry.id === photoMatch[1]; });
      if (!property) { sendJson(response, 404, { error: 'Property not found.' }); return; }
      property.photos = Array.isArray(property.photos) ? property.photos : [];
      if (property.photos.length >= MAX_PHOTOS_PER_PROPERTY) {
        sendJson(response, 400, { error: 'Ek property me max ' + MAX_PHOTOS_PER_PROPERTY + ' photos. Purani hatao pehle.' });
        return;
      }
      const mediaId = 'm_' + crypto.randomBytes(12).toString('hex');
      const caption = String(body.caption || '').slice(0, 120);
      await pool.query(
        'INSERT INTO media (id, property_id, mime, bytes, bytes_size, caption) VALUES ($1,$2,$3,$4,$5,$6)',
        [mediaId, property.id, mime, bytes, bytes.length, caption]
      );
      property.photos.push({ id: mediaId, caption });
      await setState(state, session.user_id);
      sendJson(response, 201, { saved: true, photo: { id: mediaId, caption }, url: '/media/' + mediaId, size: bytes.length });
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return;
  }

  const photoDeleteMatch = pathname.match(/^\/api\/properties\/([A-Za-z0-9-]+)\/photos\/(m_[a-f0-9]{24})$/);
  if (request.method === 'DELETE' && photoDeleteMatch) {
    const session = await requireSession(request, response, true);
    if (!session) return;
    try {
      const state = await getState();
      const property = state.properties.find(function (entry) { return entry.id === photoDeleteMatch[1]; });
      if (!property) { sendJson(response, 404, { error: 'Property not found.' }); return; }
      property.photos = (Array.isArray(property.photos) ? property.photos : []).filter(function (photo) { return photo.id !== photoDeleteMatch[2]; });
      await pool.query('DELETE FROM media WHERE id = $1', [photoDeleteMatch[2]]);
      await setState(state, session.user_id);
      sendJson(response, 200, { deleted: true });
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return;
  }

  // ── Outbox: list + stats ──
  if (request.method === 'GET' && pathname === '/api/outbox') {
    const session = await requireSession(request, response, false);
    if (!session) return;
    const [items, stats] = await Promise.all([integrations.outbox.list({ limit: 50 }), integrations.outbox.stats()]);
    sendJson(response, 200, { items, stats, status: integrations.status() });
    return;
  }

  // ── Outbox: create a draft by hand ──
  if (request.method === 'POST' && pathname === '/api/outbox') {
    const session = await requireSession(request, response, true);
    if (!session) return;
    const body = await readJson(request);
    try {
      const item = await integrations.outbox.createDraft({
        leadId: String(body.leadId || ''), channel: String(body.channel || 'whatsapp'),
        body: String(body.body || ''), kind: body.kind || 'reply', createdBy: session.username
      });
      sendJson(response, 201, { item });
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return;
  }

  // ── Outbox: AI draft (LLM writes, human still approves) ──
  if (request.method === 'POST' && pathname === '/api/outbox/ai-draft') {
    const session = await requireSession(request, response, true);
    if (!session) return;
    const body = await readJson(request);
    try {
      const item = await integrations.outbox.draftWithAI({
        leadId: String(body.leadId || ''), channel: String(body.channel || 'whatsapp'),
        inbound: String(body.inbound || ''), createdBy: session.username,
        propertyId: String(body.propertyId || ''), attach: String(body.attach || 'auto')
      });
      sendJson(response, 201, { item });
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }
    return;
  }

  // ── Outbox: approve & send / reject ──
  const outboxAction = pathname.match(/^\/api\/outbox\/(\d+)\/(approve|reject)$/);
  if (request.method === 'POST' && outboxAction) {
    const session = await requireSession(request, response, true);
    if (!session) return;
    const id = Number(outboxAction[1]);
    try {
      if (outboxAction[2] === 'approve') {
        const result = await integrations.outbox.approveAndSend(id, session.username);
        sendJson(response, 200, { sent: !result.dryRun, dryRun: !!result.dryRun, item: result });
      } else {
        const item = await integrations.outbox.reject(id, session.username);
        if (!item) { sendJson(response, 409, { error: 'Draft is not in a rejectable state.' }); return; }
        sendJson(response, 200, { rejected: true, item });
      }
    } catch (error) {
      sendJson(response, 409, { error: error.message });
    }
    return;
  }

  sendJson(response, 404, { error: 'Not found.' });
}

// ── Webhooks: verify signature, record inbound, auto-draft a reply for approval ──
async function handleWebhook(request, response, url) {
  const channel = url.pathname.endsWith('/whatsapp') ? 'whatsapp' : 'instagram';

  if (channel === 'whatsapp' && request.method === 'GET') {
    const check = integrations.whatsapp.verifyWebhook({
      'hub.mode': url.searchParams.get('hub.mode'),
      'hub.verify_token': url.searchParams.get('hub.verify_token'),
      'hub.challenge': url.searchParams.get('hub.challenge')
    });
    if (check.ok) { sendText(response, 200, check.challenge); return; }
    sendText(response, 403, 'Verification failed: ' + check.reason);
    return;
  }

  if (request.method !== 'POST') { sendText(response, 405, 'Method not allowed.'); return; }

  const raw = await readRaw(request);
  const signature = request.headers['x-hub-signature-256'];
  const verifier = channel === 'whatsapp' ? integrations.whatsapp : integrations.instagram;
  const signatureOk = verifier.verifySignature(raw, signature);

  if (!signatureOk && process.env.META_APP_SECRET) {
    console.warn('Rejected webhook with bad signature on channel ' + channel);
    sendText(response, 401, 'Invalid signature.');
    return;
  }

  let payload = null;
  try { payload = JSON.parse(raw || '{}'); } catch (_) { payload = {}; }

  const events = channel === 'whatsapp' ? integrations.whatsapp.parseWebhook(payload) : integrations.instagram.parseWebhook(payload);
  let drafted = 0;

  for (const event of events) {
    if (event.kind === 'status' || !event.text) continue; // delivery receipts / non-text
    try {
      const { contact, isNew } = await integrations.outbox.recordInbound({ ...event, channel });
      const leadId = contact.lead_id;
      if (!isNew && leadId && leadId !== 'UNLINKED' && integrations.llm) {
        await integrations.outbox.draftWithAI({
          leadId, channel, inbound: event.text, createdBy: 'auto:inbound-webhook'
        });
        drafted += 1;
      }
    } catch (error) {
      console.error('Webhook handling failed:', error.message);
    }
  }

  // Always 200 quickly — Meta retries non-2xx responses.
  sendJson(response, 200, { received: true, events: events.length, draftsCreated: drafted, signatureVerified: signatureOk });
}

function serveStatic(request, response, url) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendText(response, 405, 'Method not allowed.');
    return;
  }
  const requestPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const decoded = decodeURIComponent(requestPath);
  const filename = path.resolve(PUBLIC_DIR, '.' + decoded);
  if (!filename.startsWith(PUBLIC_DIR + path.sep) && filename !== path.join(PUBLIC_DIR, 'index.html')) {
    sendText(response, 403, 'Forbidden.');
    return;
  }
  fs.readFile(filename, function (error, content) {
    if (error) {
      sendText(response, error.code === 'ENOENT' ? 404 : 500, error.code === 'ENOENT' ? 'Not found.' : 'Unable to read file.');
      return;
    }
    securityHeaders(response);
    response.writeHead(200, { 'Content-Type': getContentType(filename) });
    response.end(request.method === 'HEAD' ? undefined : content);
  });
}

// Public media (no login): Meta fetches photos from here, and the shared property page uses it too.
async function serveMedia(request, response, mediaId) {
  if (request.method !== 'GET' && request.method !== 'HEAD') { sendText(response, 405, 'Method not allowed.'); return; }
  if (!MEDIA_ID_PATTERN.test(mediaId)) { sendText(response, 404, 'Not found.'); return; }
  const result = await pool.query('SELECT mime, bytes FROM media WHERE id = $1', [mediaId]);
  if (!result.rowCount) { sendText(response, 404, 'Not found.'); return; }
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'");
  response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  response.writeHead(200, { 'Content-Type': result.rows[0].mime, 'Content-Length': result.rows[0].bytes.length });
  response.end(request.method === 'HEAD' ? undefined : result.rows[0].bytes);
}

// Public property page: photos + map for clients (no login, no other data).
async function servePropertyPage(request, response, propertyId) {
  if (request.method !== 'GET' && request.method !== 'HEAD') { sendText(response, 405, 'Method not allowed.'); return; }
  const state = await getState();
  const property = (state.properties || []).find(function (entry) { return entry.id === propertyId; });
  if (!property) { sendText(response, 404, 'Property not found.'); return; }
  const protocol = String(request.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  const baseUrl = process.env.PUBLIC_BASE_URL || (protocol + '://' + (request.headers.host || 'localhost'));
  const body = renderPropertyPage(property, baseUrl);
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-src https://www.google.com https://maps.google.com; base-uri 'none'; form-action 'none'; object-src 'none'");
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' });
  response.end(request.method === 'HEAD' ? undefined : body);
}

const server = http.createServer(function (request, response) {
  const url = new URL(request.url, 'http://localhost');
  const mediaMatch = url.pathname.match(/^\/media\/(m_[a-f0-9]{24})(?:\.(?:jpg|jpeg|png|webp))?$/);
  const pageMatch = url.pathname.match(/^\/p\/([A-Za-z0-9-]+)$/);
  let handler;
  if (url.pathname.indexOf('/api/') === 0) handler = handleApi(request, response, url);
  else if (mediaMatch) handler = serveMedia(request, response, mediaMatch[1]);
  else if (pageMatch) handler = servePropertyPage(request, response, pageMatch[1]);
  else handler = Promise.resolve(serveStatic(request, response, url));
  handler.catch(function (error) {
    console.error('Request failed:', error.message);
    if (!response.headersSent) sendJson(response, 500, { error: 'The server could not complete this Test Mode request.' });
    else response.end();
  });
});

async function start() {
  await ensureBootstrap();
  server.listen(PORT, '0.0.0.0', function () {
    console.log('RealEstate AI TEST portal listening on port ' + PORT + '. No communication integrations are enabled.');
  });
}

start().catch(function (error) {
  console.error('Startup failed:', error.message);
  process.exit(1);
});
