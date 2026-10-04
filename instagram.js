'use strict';

const crypto = require('crypto');
const { fetchJson } = require('./http');

// Instagram Messaging adapter (Instagram API with Instagram Login / Messenger Platform).
// Hard rules enforced here:
//  - You can only reply to a user who messaged you, inside the 24h window.
//  - The HUMAN_AGENT tag (7 days) is for REAL HUMAN replies only -> refused for AI drafts.
function createInstagram(config) {
  const ig = config.meta.instagram;
  const version = config.meta.graphVersion;
  const url = (path) => `${ig.baseUrl}/${version}/${ig.igUserId}${path}`;

  async function sendText({ to, body, humanAgent = false, aiGenerated = false }) {
    if (!ig.igUserId || !ig.token) throw new Error('Instagram is not configured.');
    if (humanAgent && aiGenerated) {
      throw new Error('Refused: the HUMAN_AGENT tag is only allowed for human-written replies (Meta policy).');
    }
    const payload = { recipient: { id: to }, message: { text: body } };
    if (humanAgent) payload.tag = 'HUMAN_AGENT';
    const result = await fetchJson(url('/messages'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${ig.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!result.ok) throw new Error(`Instagram send failed (${result.status}): ${JSON.stringify(result.body).slice(0, 300)}`);
    return { providerMessageId: result.body?.message_id || null, raw: result.body };
  }

  function parseWebhook(payload) {
    const events = [];
    if (!payload || (payload.object !== 'instagram' && payload.object !== 'page')) return events;
    (payload.entry || []).forEach((entry) => {
      (entry.messaging || []).forEach((m) => {
        if (m.message?.is_echo) return; // ignore our own outbound echoes
        events.push({
          channel: 'instagram',
          from: m.sender?.id,
          text: m.message?.text || '',
          providerMessageId: m.message?.mid || '',
          receivedAt: new Date(Number(m.timestamp || Date.now())).toISOString(),
          type: 'text'
        });
      });
    });
    return events;
  }

  function verifySignature(rawBody, signatureHeader) {
    if (!config.meta.appSecret) return false;
    if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false;
    const expected = crypto.createHmac('sha256', config.meta.appSecret).update(rawBody, 'utf8').digest('hex');
    const provided = signatureHeader.slice('sha256='.length);
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(provided, 'utf8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  return { sendText, parseWebhook, verifySignature };
}

module.exports = { createInstagram };
