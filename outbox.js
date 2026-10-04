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

function createOutbox({ pool, config, safety, whatsapp, instagram, llm }) {
  async function getLead(leadId) {
    const result = await pool.query("SELECT state->'leads' AS leads FROM app_state WHERE singleton = TRUE");
    const leads = result.rows[0]?.leads || [];
    return leads.find((lead) => lead.id === leadId) || null;
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

  async function draftWithAI({ leadId, channel, inbound = '', createdBy, languageHint = '' }) {
    const lead = await getLead(leadId);
    if (!lead) throw new Error(`Lead ${leadId} not found.`);
    const body = await llm.draftReply({ lead, inbound, channel, languageHint });
    const classification = inbound ? await llm.classify(inbound).catch(() => null) : null;
    return createDraft({ leadId, channel, body, kind: 'reply', aiGenerated: true, createdBy,
      meta: { model: config.llm.model, provider: config.llm.provider, inbound, classification } });
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

    // Dry run: TEST mode or unconfigured channel -> log what would have been sent.
    const dryRun = !config.live || (item.channel === 'whatsapp' ? !config.meta.whatsapp.token : !config.meta.instagram.token);
    if (dryRun) {
      await pool.query(
        "UPDATE outbox SET status='dry_run', approved_by=$2, approved_at=NOW(), meta = meta || $3::jsonb WHERE id=$1",
        [id, user, JSON.stringify({ dryRun: true, note: 'TEST mode / channel not configured — nothing left the server.' })]
      );
      return { ...item, status: 'dry_run', dryRun: true };
    }

    let sent;
    if (item.channel === 'whatsapp') {
      sent = await whatsapp.sendText({ to: contact.handle, body: item.body });
    } else if (item.channel === 'instagram') {
      sent = await instagram.sendText({ to: contact.handle, body: item.body, humanAgent: item.human_agent, aiGenerated: item.ai_generated });
    } else {
      throw new Error(`Unsupported channel: ${item.channel}`);
    }
    safety.noteSend(contact.handle, item.channel);
    const updated = await pool.query(
      `UPDATE outbox SET status='sent', approved_by=$2, approved_at=NOW(), sent_at=NOW(), provider_message_id=$3 WHERE id=$1 RETURNING *`,
      [id, user, sent.providerMessageId]
    );
    return { ...updated.rows[0], dryRun: false };
  }

  async function stats() {
    const result = await pool.query('SELECT status, COUNT(*)::int AS count FROM outbox GROUP BY status');
    return Object.fromEntries(result.rows.map((row) => [row.status, row.count]));
  }

  return { getLead, getContact, upsertContact, recordInbound, createDraft, draftWithAI, list, reject, approveAndSend, stats };
}

module.exports = { createOutbox };
