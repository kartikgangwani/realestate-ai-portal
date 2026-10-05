'use strict';

const { config, whatsappReady, instagramReady, llmReady, webhookReady } = require('./config');
const { createWhatsApp } = require('./whatsapp');
const { createInstagram } = require('./instagram');
const { createLLM } = require('./llm');
const { createSafety } = require('./safety');
const { createOutbox } = require('./outbox');

function createIntegrations({ pool }) {
  const whatsapp = createWhatsApp(config);
  const instagram = createInstagram(config);
  const llm = createLLM(config);
  const safety = createSafety(config, {});
  const outbox = createOutbox({ pool, config, safety, whatsapp, instagram, llm });

  function status() {
    return {
      mode: config.mode,
      live: config.live,
      approvalRequired: config.approvalRequired,
      autoSend: config.autoSend,
      channels: {
        whatsapp: { ready: whatsappReady(), baseUrl: config.meta.whatsapp.baseUrl, reason: whatsappReady() ? 'credentials present' : 'missing WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_TOKEN' },
        instagram: { ready: instagramReady(), baseUrl: config.meta.instagram.baseUrl, reason: instagramReady() ? 'credentials present' : 'missing IG_USER_ID / IG_TOKEN' },
        llm: {
          ready: llmReady(), provider: config.llm.provider, model: config.llm.model, baseUrl: config.llm.baseUrl,
          reason: config.llm.provider === 'mock' ? 'offline mock provider (no API key needed)'
            : (llmReady() ? 'API key present' : 'missing LLM_API_KEY')
        }
      },
      webhookSignatureCheck: webhookReady(),
      limits: config.limits
    };
  }

  return { config, whatsapp, instagram, llm, safety, outbox, status };
}

module.exports = { createIntegrations };
