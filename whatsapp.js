'use strict';

const crypto = require('crypto');
const { fetchJson } = require('./http');

// WhatsApp Cloud API adapter (Meta-hosted).
// Docs: business-initiated messages outside the 24h window REQUIRE an approved template.
function createWhatsApp(config) {
  const wa = config.meta.whatsapp;
  const version = config.meta.graphVersion;
  const url = (path) => `${wa.baseUrl}/${version}/${wa.phoneNumberId}${path}`;

  async function sendText({ to, body }) {
    if (!wa.phoneNumberId || !wa.token) throw new Error('WhatsApp is not configured.');
    const result = await fetchJson(url('/messages'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${wa.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { preview_url: false, body } })
    });
    if (!result.ok) throw new Error(`WhatsApp send failed (${result.status}): ${JSON.stringify(result.body).slice(0, 300)}`);
    return { providerMessageId: result.body?.messages?.[0]?.id || null, raw: result.body };
  }

  async function sendTemplate({ to, name, language = 'en', bodyParams = [] }) {
    if (!wa.phoneNumberId || !wa.token) throw new Error('WhatsApp is not configured.');
    const payload = {
      messaging_product: 'whatsapp', to, type: 'template',
      template: { name, language: { code: language },
        components: bodyParams.length ? [{ type: 'body', parameters: bodyParams.map((p) => ({ type: 'text', text: String(p) })) }] : [] }
    };
    const result = await fetchJson(url('/messages'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${wa.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!result.ok) throw new Error(`WhatsApp template send failed (${result.status}): ${JSON.stringify(result.body).slice(0, 300)}`);
    return { providerMessageId: result.body?.messages?.[0]?.id || null, raw: result.body };
  }

  // Webhook subscription handshake (GET).
  function verifyWebhook(query) {
    if (query['hub.mode'] !== 'subscribe') return { ok: false, reason: 'not a subscribe request' };
    if (!wa.verifyToken) return { ok: false, reason: 'WHATSAPP_VERIFY_TOKEN not set' };
    if (query['hub.verify_token'] !== wa.verifyToken) return { ok: false, reason: 'verify token mismatch' };
    return { ok: true, challenge: query['hub.challenge'] || '' };
  }

  // Normalise inbound webhook payloads into simple events.
  function parseWebhook(payload) {
    const events = [];
    if (!payload || payload.object !== 'whatsapp_business_account') return events;
    (payload.entry || []).forEach((entry) => {
      (entry.changes || []).forEach((change) => {
        const value = change.value || {};
        const contacts = value.contacts || [];
        (value.messages || []).forEach((message) => {
          events.push({
            channel: 'whatsapp',
            from: message.from,
            name: contacts.find((c) => c.wa_id === message.from)?.profile?.name || '',
            text: message.text?.body || (message.button ? message.button.text : ''),
            providerMessageId: message.id,
            receivedAt: new Date(Number(message.timestamp || Date.now() / 1000) * 1000).toISOString(),
            type: message.type
          });
        });
        (value.statuses || []).forEach((statusEvent) => {
          events.push({ channel: 'whatsapp', kind: 'status', status: statusEvent.status, providerMessageId: statusEvent.id, from: statusEvent.recipient_id });
        });
      });
    });
    return events;
  }

  // X-Hub-Signature-256 verification (Meta signs the raw request body).
  function verifySignature(rawBody, signatureHeader) {
    if (!config.meta.appSecret) return false;
    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
    const expected = crypto.createHmac('sha256', config.meta.appSecret).update(rawBody, 'utf8').digest('hex');
    const provided = signatureHeader.slice('sha256='.length);
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(provided, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  return { sendText, sendTemplate, verifyWebhook, parseWebhook, verifySignature };
}

module.exports = { createWhatsApp };
