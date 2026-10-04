'use strict';

// Guard rails that sit between "a human approved this" and "a message leaves the building".
function createSafety(config, repos) {
  const sendLog = []; // in-memory; production would move this to PostgreSQL

  function redact(handle) {
    const value = String(handle || '');
    if (value.length <= 4) return '••••';
    return '••••' + value.slice(-4);
  }

  function recentSendCount(handle, sinceMs) {
    const cutoff = Date.now() - sinceMs;
    return sendLog.filter((row) => row.handle === handle && row.at > cutoff).length;
  }

  function lastSendAt(handle) {
    const rows = sendLog.filter((row) => row.handle === handle);
    return rows.length ? rows[rows.length - 1].at : 0;
  }

  function globalCountLastHour() {
    const cutoff = Date.now() - 3600 * 1000;
    return sendLog.filter((row) => row.at > cutoff).length;
  }

  function noteSend(handle, channel) {
    sendLog.push({ handle, channel, at: Date.now() });
    if (sendLog.length > 500) sendLog.shift();
  }

  /**
   * Every outbound message must pass here. Returns { ok, reason }.
   * Order matters: consent -> DNC -> window -> rate limits.
   */
  function assertSendAllowed({ contact, lead, channel, kind, aiGenerated, humanAgent }) {
    if (!contact) return { ok: false, reason: 'No contact record for this lead on this channel (consent unknown).' };
    if (!contact.consent_at) return { ok: false, reason: 'No recorded opt-in consent. Meta requires explicit opt-in before business messaging.' };
    if (lead && lead.dnc) return { ok: false, reason: 'Lead is marked Do Not Contact.' };

    const windowHours = config.limits.replyWindowHours;
    const lastInbound = contact.last_inbound_at ? new Date(contact.last_inbound_at).getTime() : 0;
    const withinWindow = lastInbound && Date.now() - lastInbound < windowHours * 3600 * 1000;

    if (kind === 'reply' && !withinWindow) {
      return { ok: false, reason: `Outside the ${windowHours}h customer-service window. Only an approved template can re-open the conversation.` };
    }
    if (kind === 'marketing' && !withinWindow) {
      return { ok: false, reason: 'Marketing outside the service window requires an approved template + opt-in.' };
    }
    if (humanAgent && aiGenerated) {
      return { ok: false, reason: 'HUMAN_AGENT tag cannot be used for AI-generated text (Meta policy).' };
    }
    if (channel === 'whatsapp') {
      const gap = (Date.now() - lastSendAt(contact.handle)) / 1000;
      if (gap < config.limits.perRecipientSeconds) {
        return { ok: false, reason: `Pair rate limit: wait ${Math.ceil(config.limits.perRecipientSeconds - gap)}s before messaging the same number again.` };
      }
    }
    if (globalCountLastHour() >= config.limits.maxPerHour) {
      return { ok: false, reason: `Global cap reached (${config.limits.maxPerHour}/hour).` };
    }
    return { ok: true, reason: 'ok', withinWindow, sentLastHour: recentSendCount(contact.handle, 3600 * 1000) };
  }

  return { assertSendAllowed, noteSend, redact, recentSendCount, globalCountLastHour };
}

module.exports = { createSafety };
