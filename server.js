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

function readJson(request) {
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
        inbound: String(body.inbound || ''), createdBy: session.username
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

const server = http.createServer(function (request, response) {
  const url = new URL(request.url, 'http://localhost');
  const handler = url.pathname.indexOf('/api/') === 0 ? handleApi(request, response, url) : Promise.resolve(serveStatic(request, response, url));
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
