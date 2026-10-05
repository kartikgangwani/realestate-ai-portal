'use strict';

// Approval-queue backed outbox.
// Nothing is ever sent straight from a draft: every message passes
// (1) consent + safety checks, (2) human approval, (3) the channel adapter.
// Meta sends WhatsApp `from` numbers as digits only (no '+'), while humans type
// '+91 98765 00111'. Normalise both sides so contact matching never fails.
function normalizeHandle(channel, handle) {
  const value = String(handle || '').trim();
  if (channel === 'whatsapp') return value.replace(/[^0-9]/g, '');
  return value;
}


// ── Attachment helpers (photos + location pin) ───────────────────────────────
// A draft can carry property photos and/or a location pin along with its text.
// Nothing is fetched from the network until a human approves the draft.
const PHOTO_WORDS = /(photo|photos|pic|pics|picture|images?|tasveer|snap|gallery|dikha|dikhao|dekhna|dekhni)/i;
const LOCATION_WORDS = /(location|address|pata|kahan|kaha|map|direction|directions|reach|route|pin|kaise pahunch|nazdeek|pass hai)/i;

function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }

function cleanGeo(geo) {
  if (!geo) return null;
  const lat = Number(geo.lat);
  const lng = Number(geo.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return {
    lat, lng,
    label: String(geo.label || '').slice(0, 120),
    area: String(geo.area || '').slice(0, 200),
    mapsUrl: String(geo.mapsUrl || '').slice(0, 500) || `https://www.google.com/maps?q=${lat},${lng}`
  };
}

// Pick the best Available property for a lead (type + location + budget closeness).
function autoMatchProperty(lead, properties) {
  const available = (properties || []).filter(function (p) { return p && p.status === 'Available'; });
  if (!available.length) return null;
  let best = null;
  let bestScore = -1;
  available.forEach(function (property) {
    let score = 0;
    if (String(property.type).toLowerCase() === String(lead.type).toLowerCase()) score += 40;
    if (String(property.location).toLowerCase() === String(lead.location).toLowerCase()) score += 25;
    const budget = Number(lead.budget) || 0;
    const price = Number(property.price) || 0;
    if (budget && price) {
      const diff = Math.abs(price - budget) / budget;
      score += diff <= 0.15 ? 20 : diff <= 0.35 ? 12 : diff <= 0.6 ? 5 : 0;
    }
    if (Array.isArray(property.photos) && property.photos.length) score += 5;
    if (cleanGeo(property.geo)) score += 5;
    if (score > bestScore) { bestScore = score; best = property; }
  });
  return best;
}

function createOutbox({ pool, config, safety, whatsapp, instagram, llm }) {
  async function getLead(leadId) {
    const result = await pool.query("SELECT state->'leads' AS leads FROM app_state WHERE singleton = TRUE");
    const leads = result.rows[0]?.leads || [];
    return leads.find((lead) => lead.id === leadId) || null;
  }

  async function getProperties() {
    const result = await pool.query("SELECT state->'properties' AS properties FROM app_state WHERE singleton = TRUE");
    return result.rows[0]?.properties || [];
  }

  async function getProperty(propertyId) {
    const properties = await getProperties();
    return properties.find((property) => property.id === propertyId) || null;
  }

  // Public URL that Meta can fetch without a login (photos are served from /media/<id>).
  function publicMediaUrl(mediaId) {
    if (!config.publicBaseUrl) {
      throw new Error('PUBLIC_BASE_URL is not set. WhatsApp/Instagram need a public https address (e.g. your Railway domain) to fetch the photo. Add PUBLIC_BASE_URL in the server settings.');
    }
    return `${config.publicBaseUrl}/media/${mediaId}`;
  }

  // Decide which attachments a draft should carry. attach: auto | photos | location | both | none
  async function resolveAttachments({ lead, propertyId, attach, inbound }) {
    const mode = ['auto', 'photos', 'location', 'both', 'none'].includes(attach) ? attach : 'auto';
    if (mode === 'none') return null;
    const properties = await getProperties();
    const property = propertyId ? properties.find((p) => p.id === propertyId) : autoMatchProperty(lead, properties);
    if (!property) return null;

    const text = String(inbound || '');
    const wantsPhotos = mode === 'photos' || mode === 'both' || mode === 'auto' && (PHOTO_WORDS.test(text) || !text);
    const wantsLocation = mode === 'location' || mode === 'both' || mode === 'auto' && (!text || LOCATION_WORDS.test(text));

    const photos = (wantsPhotos && Array.isArray(property.photos) ? property.photos : [])
      .filter((photo) => photo && photo.id)
      .slice(0, 5)
      .map((photo) => ({ id: photo.id, caption: String(photo.caption || '').slice(0, 120) }));
    const geo = wantsLocation ? cleanGeo(property.geo) : null;

    if (!photos.length && !geo) return null;
    return { propertyId: property.id, propertyName: property.name, photos, location: geo };
  }

  function attachmentSummary(attachments) {
    if (!attachments) return '';
    const parts = [];
    if (attachments.photos?.length) parts.push(`${attachments.photos.length} photo${attachments.photos.length > 1 ? 's' : ''}`);
    if (attachments.location) parts.push('location pin');
    return parts.length ? `${attachments.propertyName || ''} — ${parts.join(' + ')}`.trim() : '';
  }

  async function getContact(leadId, channel) {
    const result = await pool.query(
      'SELECT * FROM contacts WHERE lead_id = $1 AND channel = $2 ORDER BY updated_at DESC LIMIT 1', [leadId, channel]);
    return result.rows[0] || null;
  }

  async function upsertContact({ leadId, channel, handle, consentSource }) {
    handle = normalizeHandle(channel, handle);
    const result = await pool.query(
      `INSERT INTO contacts (lead_id, channel, handle, consent_source, consent_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (channel, handle) DO UPDATE SET lead_id = EXCLUDED.lead_id,
         consent_source = EXCLUDED.consent_source, consent_at = NOW(), updated_at = NOW()
       RETURNING *`,
      [leadId, channel, handle, consentSource || 'test-consent']
    );
    return result.rows[0];
  }

  async function recordInbound({ channel, from, text, providerMessageId, receivedAt, name }) {
    await pool.query(
      'INSERT INTO webhook_events (channel, payload) VALUES ($1, $2::jsonb)',
      [channel, JSON.stringify({ from, text, providerMessageId, receivedAt, name })]
    );
    // Any inbound message: refresh the 24h window and link the contact to a lead.
    from = normalizeHandle(channel, from);
    const existing = await pool.query('SELECT * FROM contacts WHERE channel = $1 AND handle = $2', [channel, from]);
    if (existing.rowCount) {
      await pool.query('UPDATE contacts SET last_inbound_at = NOW(), updated_at = NOW() WHERE id = $1', [existing.rows[0].id]);
      return { contact: { ...existing.rows[0], last_inbound_at: new Date() }, isNew: false };
    }
    // First time we see this handle: park it against an unlinked contact row for human triage.
    const created = await pool.query(
      `INSERT INTO contacts (lead_id, channel, handle, consent_source, consent_at, last_inbound_at, updated_at)
       VALUES ('UNLINKED', $1, $2, 'inbound-message', NOW(), NOW(), NOW()) RETURNING *`,
      [channel, from]
    );
    return { contact: created.rows[0], isNew: true };
  }

  async function createDraft({ leadId, channel, body, kind = 'reply', aiGenerated = false, humanAgent = false, createdBy, meta = {} }) {
    const lead = await getLead(leadId);
    if (!lead) throw new Error(`Lead ${leadId} not found.`);
    const contact = await getContact(leadId, channel);
    const check = safety.assertSendAllowed({ contact, lead, channel, kind, aiGenerated, humanAgent });
    const status = check.ok ? 'draft' : 'blocked';
    const result = await pool.query(
      `INSERT INTO outbox (channel, lead_id, to_handle, body, kind, status, ai_generated, human_agent, created_by, blocked_reason, meta)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb) RETURNING *`,
      [channel, leadId, contact ? contact.handle : '', body, kind, status, aiGenerated, humanAgent, createdBy,
       check.ok ? null : check.reason, JSON.stringify(meta)]
    );
    return result.rows[0];
  }

  async function draftWithAI({ leadId, channel, inbound = '', createdBy, languageHint = '', propertyId = '', attach = 'auto' }) {
    const lead = await getLead(leadId);
    if (!lead) throw new Error(`Lead ${leadId} not found.`);
    const attachments = await resolveAttachments({ lead, propertyId, attach, inbound });
    const body = await llm.draftReply({ lead, inbound, channel, languageHint, attachmentHint: attachmentSummary(attachments) });
    const classification = inbound ? await llm.classify(inbound).catch(() => null) : null;
    return createDraft({ leadId, channel, body, kind: 'reply', aiGenerated: true, createdBy,
      meta: { model: config.llm.model, provider: config.llm.provider, inbound, classification, attachments } });
  }

  async function list({ limit = 50 } = {}) {
    const result = await pool.query('SELECT * FROM outbox ORDER BY created_at DESC LIMIT $1', [limit]);
    const leads = await pool.query("SELECT state->'leads' AS leads FROM app_state WHERE singleton = TRUE");
    const leadMap = new Map((leads.rows[0]?.leads || []).map((lead) => [lead.id, lead.name]));
    return result.rows.map((row) => ({ ...row, to_handle: safety.redact(row.to_handle), lead_name: leadMap.get(row.lead_id) || row.lead_id }));
  }

  async function reject(id, user) {
    const result = await pool.query(
      "UPDATE outbox SET status = 'rejected', approved_by = $2, approved_at = NOW() WHERE id = $1 AND status IN ('draft','blocked') RETURNING *",
      [id, user]
    );
    return result.rows[0] || null;
  }

  async function approveAndSend(id, user) {
    const found = await pool.query('SELECT * FROM outbox WHERE id = $1', [id]);
    if (!found.rowCount) throw new Error('Outbox item not found.');
    const item = found.rows[0];
    if (item.status === 'sent') throw new Error('Already sent.');
    if (item.status === 'dry_run') throw new Error('Already processed (dry run in TEST mode).');
    if (item.status === 'blocked') throw new Error(`Blocked: ${item.blocked_reason}`);
    if (item.status === 'rejected') throw new Error('This draft was rejected.');

    const lead = await getLead(item.lead_id);
    const contact = await getContact(item.lead_id, item.channel);
    const check = safety.assertSendAllowed({
      contact, lead, channel: item.channel, kind: item.kind,
      aiGenerated: item.ai_generated, humanAgent: item.human_agent
    });
    if (!check.ok) {
      await pool.query("UPDATE outbox SET status='blocked', blocked_reason=$2 WHERE id=$1", [id, check.reason]);
      throw new Error(`Blocked at send time: ${check.reason}`);
    }

    // Attachments decided at draft time (photos + location pin).
    const attachments = (item.meta && item.meta.attachments) || null;
    const photos = attachments && Array.isArray(attachments.photos) ? attachments.photos : [];
    const location = attachments && attachments.location ? attachments.location : null;
    const parts = [];
    if (item.body) parts.push('text');
    if (photos.length) parts.push(photos.length + ' photo(s)');
    if (location) parts.push('location pin');
    const summary = parts.join(' + ') || 'nothing';

    // Dry run: TEST mode or unconfigured channel -> log what would have been sent.
    const dryRun = !config.live || (item.channel === 'whatsapp' ? !config.meta.whatsapp.token : !config.meta.instagram.token);
    if (dryRun) {
      await pool.query(
        "UPDATE outbox SET status='dry_run', approved_by=$2, approved_at=NOW(), meta = meta || $3::jsonb WHERE id=$1",
        [id, user, JSON.stringify({ dryRun: true, wouldHaveSent: summary, note: 'TEST mode / channel not configured — nothing left the server.' })]
      );
      return { ...item, status: 'dry_run', dryRun: true, wouldHaveSent: summary };
    }

    let providerMessageId = null;
    if (item.channel === 'whatsapp') {
      if (item.body) {
        providerMessageId = (await whatsapp.sendText({ to: contact.handle, body: item.body })).providerMessageId;
      }
      for (let index = 0; index < photos.length; index += 1) {
        const photo = photos[index];
        const caption = photo.caption || (index === 0 ? (attachments.propertyName || '') : '');
        const sent = await whatsapp.sendImage({ to: contact.handle, link: publicMediaUrl(photo.id), caption });
        providerMessageId = providerMessageId || sent.providerMessageId;
        if (index < photos.length - 1) await sleep(1500); // Meta pair pacing
      }
      if (location) {
        const sent = await whatsapp.sendLocation({
          to: contact.handle, latitude: location.lat, longitude: location.lng,
          name: location.label || attachments.propertyName || '', address: location.area || ''
        });
        providerMessageId = providerMessageId || sent.providerMessageId;
      }
    } else if (item.channel === 'instagram') {
      if (item.body) {
        providerMessageId = (await instagram.sendText({ to: contact.handle, body: item.body, humanAgent: item.human_agent, aiGenerated: item.ai_generated })).providerMessageId;
      }
      for (let index = 0; index < photos.length; index += 1) {
        const sent = await instagram.sendImage({ to: contact.handle, url: publicMediaUrl(photos[index].id), humanAgent: item.human_agent, aiGenerated: item.ai_generated });
        providerMessageId = providerMessageId || sent.providerMessageId;
        if (index < photos.length - 1) await sleep(1500);
      }
      if (location) {
        // Instagram has no native location message: send the Google Maps link as text.
        const mapsLink = location.mapsUrl || `https://www.google.com/maps?q=${location.lat},${location.lng}`;
        const lines = [location.label || attachments.propertyName || 'Property location', location.area || '', mapsLink].filter(Boolean).join('\n');
        const sent = await instagram.sendText({ to: contact.handle, body: lines, humanAgent: item.human_agent, aiGenerated: item.ai_generated });
        providerMessageId = providerMessageId || sent.providerMessageId;
      }
    } else {
      throw new Error(`Unsupported channel: ${item.channel}`);
    }
    safety.noteSend(contact.handle, item.channel);
    const updated = await pool.query(
      `UPDATE outbox SET status='sent', approved_by=$2, approved_at=NOW(), sent_at=NOW(), provider_message_id=$3, meta = meta || $4::jsonb WHERE id=$1 RETURNING *`,
      [id, user, providerMessageId, JSON.stringify({ sentSummary: summary })]
    );
    return { ...updated.rows[0], dryRun: false };
  }

  async function stats() {
    const result = await pool.query('SELECT status, COUNT(*)::int AS count FROM outbox GROUP BY status');
    return Object.fromEntries(result.rows.map((row) => [row.status, row.count]));
  }

  return { getLead, getProperty, getProperties, getContact, upsertContact, recordInbound, createDraft, draftWithAI, list, reject, approveAndSend, stats, publicMediaUrl, autoMatchProperty };
}

module.exports = { createOutbox };
