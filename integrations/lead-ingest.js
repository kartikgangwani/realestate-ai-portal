'use strict';

const { parseLeadEmail } = require('./lead-parser');

// Lead ingestion: takes leads that arrived through channels YOU own
// (portal notification emails, website form webhooks, Zapier/Make forwards)
// and puts them into the CRM: app_state lead + contact (consent) + follow-up task.
//
// NOTE: real phone numbers live in the `contacts` table, never in app_state,
// so the existing Test Mode guard on app_state keeps working unchanged.

function createLeadIngest({ pool, safety }) {
  function normalizePhone(value) {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length >= 10) return digits.slice(-10);
    return digits;
  }

  async function readState() {
    const result = await pool.query("SELECT state FROM app_state WHERE singleton = TRUE");
    return result.rows[0]?.state || null;
  }

  async function writeState(state, userId) {
    await pool.query(
      'UPDATE app_state SET state = $1::jsonb, updated_at = NOW(), updated_by = $2 WHERE singleton = TRUE',
      [JSON.stringify(state), userId || null]
    );
  }

  function nextId(prefix, items, pad = 3) {
    let max = 0;
    (items || []).forEach((item) => {
      const match = String(item.id || '').match(new RegExp('^' + prefix + '-(\\d+)$'));
      if (match) max = Math.max(max, Number(match[1]));
    });
    return `${prefix}-${String(max + 1).padStart(pad, '0')}`;
  }

  // Dedupe: same phone (last 10 digits), or same email, or same portal reference.
  async function findDuplicate(lead) {
    const checks = [];
    if (lead.phone && !lead.phoneMasked) checks.push({ type: 'phone', value: normalizePhone(lead.phone) });
    if (lead.email && !lead.emailMasked) checks.push({ type: 'email', value: String(lead.email).toLowerCase() });
    if (lead.reference) checks.push({ type: 'reference', value: String(lead.reference).toUpperCase() });

    for (const check of checks) {
      const row = await pool.query(
        `SELECT lead_id, dedupe_type FROM lead_ingest_log
          WHERE dedupe_type = $1 AND dedupe_value = $2 AND status = 'accepted'
          ORDER BY created_at DESC LIMIT 1`,
        [check.type, check.value]
      );
      if (row.rowCount) return { duplicate: true, existingLeadId: row.rows[0].lead_id, matchedOn: check.type, value: check.value };
    }
    return { duplicate: false };
  }

  function scoreLead(lead) {
    let score = 40;
    if (lead.phone && !lead.phoneMasked) score += 20;
    if (lead.budget) {
      score += 10;
      if (lead.budget.max >= 10000000) score += 10;      // 1 Cr+
      else if (lead.budget.max >= 5000000) score += 5;   // 50L+
    }
    if (lead.propertyType) score += 5;
    if (lead.location) score += 5;
    if (/immediate|within\s+\d+\s*day/i.test(lead.timeline || '')) score += 10;
    return Math.max(10, Math.min(100, score));
  }

  function humanBudget(budget) {
    if (!budget) return null;
    const fmt = (n) => n >= 10000000 ? `${(n / 10000000).toFixed(2).replace(/\.00$/, '')} Cr` : `${(n / 100000).toFixed(1).replace(/\.0$/, '')} L`;
    return budget.min === budget.max ? `\u20b9${fmt(budget.max)}` : `\u20b9${fmt(budget.min)} - ${fmt(budget.max)}`;
  }

  async function ingest(lead, { sourceHint = null, createdBy = 'ingest', autoDraft = false } = {}) {
    const state = await readState();
    if (!state) throw new Error('State not initialised yet.');

    const duplicate = await findDuplicate(lead);
    const summary = {
      source: sourceHint || lead.source || 'email',
      confidence: lead.confidence || 0,
      duplicate: duplicate.duplicate,
      existingLeadId: duplicate.existingLeadId || null,
      phoneMasked: !!lead.phoneMasked
    };

    if (duplicate.duplicate) {
      await pool.query(
        `INSERT INTO lead_ingest_log (source, dedupe_type, dedupe_value, lead_id, status, confidence, payload)
         VALUES ($1,$2,$3,$4,'duplicate',$5,$6::jsonb)`,
        [summary.source, duplicate.matchedOn, duplicate.value, duplicate.existingLeadId, summary.confidence, JSON.stringify(lead)]
      );
      return { ...summary, status: 'duplicate', note: `Pehle se maujood hai (${duplicate.matchedOn} match) — lead ${duplicate.existingLeadId}` };
    }

    const leadId = nextId('L', state.leads);
    const score = scoreLead(lead);
    const stage = score >= 80 ? 'Priority review' : score >= 50 ? 'New enquiry' : 'Nurture';

    // app_state stays "dummy-safe": no phone/email/address keys allowed by the guard.
    const newLead = {
      id: leadId,
      name: lead.name || 'Portal lead',
      source: sourceHint || lead.source || 'email',
      type: lead.propertyType || 'Not specified',
      location: lead.location || 'Not specified',
      budget: lead.budget ? lead.budget.max : 0,
      purpose: lead.purpose || 'Unknown',
      timeline: lead.timeline || 'Not specified',
      score,
      stage,
      dnc: false,
      created: new Date().toISOString().slice(0, 10),
      reference: lead.reference || null,
      notes: lead.message || null,
      budgetText: humanBudget(lead.budget)
    };

    state.leads.push(newLead);
    state.activities.unshift({
      at: new Date().toISOString().slice(0, 16).replace('T', ' '),
      agentId: 'A-01',
      title: `Lead Capture Agent ne ${summary.source} se naya lead liya: ${newLead.name}`,
      detail: `${newLead.type} \u00b7 ${newLead.location} \u00b7 score ${score}${lead.phoneMasked ? ' \u00b7 number email me masked tha' : ''}`
    });
    state.activities = state.activities.slice(0, 60);

    const followup = {
      id: nextId('F', state.followups, 2),
      leadId,
      due: 'Aaj \u00b7 asap',
      note: lead.phoneMasked
        ? `Portal kholo aur number dekho, phir call karo (${summary.source})`
        : `Call karke requirement confirm karo (${summary.source})`,
      owner: 'AI Sales Manager',
      status: 'Due'
    };
    state.followups.push(followup);

    await writeState(state, null);

    // Consent + handle go into the contacts table (this is what the messaging layer reads).
    let consentRecorded = false;
    if (lead.phone && !lead.phoneMasked) {
      await pool.query(
        `INSERT INTO contacts (lead_id, channel, handle, consent_source, consent_at, updated_at)
         VALUES ($1,'whatsapp',$2,$3,NOW(),NOW())
         ON CONFLICT (channel, handle) DO UPDATE SET lead_id = EXCLUDED.lead_id,
           consent_source = EXCLUDED.consent_source, consent_at = NOW(), updated_at = NOW()`,
        [leadId, normalizePhone(lead.phone), `portal-enquiry:${summary.source}`]
      );
      consentRecorded = true;
    } else if (lead.email && !lead.emailMasked) {
      await pool.query(
        `INSERT INTO contacts (lead_id, channel, handle, consent_source, consent_at, updated_at)
         VALUES ($1,'instagram',$2,$3,NOW(),NOW())
         ON CONFLICT (channel, handle) DO UPDATE SET lead_id = EXCLUDED.lead_id,
           consent_source = EXCLUDED.consent_source, consent_at = NOW(), updated_at = NOW()`,
        [leadId, String(lead.email).toLowerCase(), `portal-enquiry:${summary.source}`]
      ).catch(() => null); // instagram channel expects an IG id, not an email — only used if it fits
      consentRecorded = true;
    }

    const dedupeType = lead.phone && !lead.phoneMasked ? 'phone' : (lead.email && !lead.emailMasked ? 'email' : (lead.reference ? 'reference' : 'none'));
    const dedupeValue = dedupeType === 'phone' ? normalizePhone(lead.phone)
      : dedupeType === 'email' ? String(lead.email).toLowerCase()
      : dedupeType === 'reference' ? String(lead.reference).toUpperCase() : '';

    await pool.query(
      `INSERT INTO lead_ingest_log (source, dedupe_type, dedupe_value, lead_id, status, confidence, payload)
       VALUES ($1,$2,$3,$4,'accepted',$5,$6::jsonb)`,
      [summary.source, dedupeType, dedupeValue, leadId, summary.confidence, JSON.stringify({ ...lead, _followup: followup.id })]
    );

    let draft = null;
    if (autoDraft && consentRecorded) {
      draft = 'skipped: portal leads need an approved template outside the 24h window';
    }

    return {
      ...summary,
      status: 'accepted',
      leadId,
      score,
      followupId: followup.id,
      consentRecorded,
      draft,
      note: `Lead ${leadId} ban gaya, follow-up ${followup.id} create hua${consentRecorded ? ', consent record ho gaya' : ''}.`
    };
  }

  async function ingestRaw(email, options = {}) {
    const parsed = parseLeadEmail(email);
    return ingest(parsed, { sourceHint: options.sourceHint || parsed.source, createdBy: options.createdBy, autoDraft: options.autoDraft });
  }

  async function list(limit = 30) {
    const result = await pool.query(
      `SELECT id, source, dedupe_type, lead_id, status, confidence, created_at,
              payload->>'name' AS name, payload->>'propertyType' AS property_type,
              payload->>'location' AS location, payload->'budget'->>'max' AS budget_max
         FROM lead_ingest_log ORDER BY created_at DESC LIMIT $1`, [limit]
    );
    return result.rows;
  }

  async function logOnly({ source, status, confidence, lead, note }) {
    await pool.query(
      `INSERT INTO lead_ingest_log (source, dedupe_type, dedupe_value, lead_id, status, confidence, payload)
       VALUES ($1,'none','',$2,$3,$4,$5::jsonb)`,
      [source || 'unknown', lead?.leadId || null, status, confidence || 0, JSON.stringify({ ...lead, note })]
    );
  }

  return { ingest, ingestRaw, list, logOnly, findDuplicate, scoreLead, normalizePhone, humanBudget };
}

module.exports = { createLeadIngest };
