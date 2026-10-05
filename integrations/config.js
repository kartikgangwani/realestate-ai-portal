'use strict';

// Central configuration for outbound integrations.
// TEST mode never calls the network. LIVE mode requires an explicit opt-in flag
// so a deployment can never "accidentally" start messaging real people.
const env = process.env;

const APP_MODE = env.APP_MODE || 'TEST';
const LIVE = APP_MODE === 'LIVE';

if (LIVE && env.ALLOW_LIVE !== 'YES-I-UNDERSTAND') {
  throw new Error('LIVE mode requires ALLOW_LIVE=YES-I-UNDERSTAND. Read GO-LIVE-CHECKLIST.md first.');
}

const config = {
  mode: APP_MODE,
  live: LIVE,
  // Human approval is the default and survives restarts unless explicitly disabled.
  approvalRequired: env.APPROVAL_REQUIRED !== 'false',
  autoSend: LIVE && env.AUTO_SEND === 'true',

  // Public URL of THIS deployment. WhatsApp/Meta fetch the photo from this address,
  // so in LIVE mode it must be the real https URL (e.g. https://xyz.up.railway.app).
  publicBaseUrl: String(env.PUBLIC_BASE_URL || '').replace(/\/+$/, ''),
  // Optional: your own WhatsApp number shown as a "contact" button on the public property page.
  contactWhatsapp: String(env.PUBLIC_CONTACT_WHATSAPP || '').replace(/[^0-9]/g, ''),

  meta: {
    appSecret: env.META_APP_SECRET || '',
    graphVersion: env.GRAPH_VERSION || 'v21.0',
    whatsapp: {
      baseUrl: env.WHATSAPP_API_BASE || 'https://graph.facebook.com',
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID || '',
      token: env.WHATSAPP_TOKEN || '',
      verifyToken: env.WHATSAPP_VERIFY_TOKEN || ''
    },
    instagram: {
      baseUrl: env.IG_API_BASE || 'https://graph.facebook.com',
      igUserId: env.IG_USER_ID || '',
      token: env.IG_TOKEN || ''
    }
  },

  llm: {
    provider: env.LLM_PROVIDER || 'openai', // 'openai' (any OpenAI-compatible) or 'anthropic'
    baseUrl: env.LLM_BASE_URL || 'https://api.openai.com/v1',
    apiKey: env.LLM_API_KEY || '',
    model: env.LLM_MODEL || 'gpt-4o-mini'
  },

  limits: {
    perRecipientSeconds: 6,  // Meta pair rate limit: 1 message / 6s to the same user
    maxPerHour: 30,          // global safety cap for this deployment
    replyWindowHours: 24     // WhatsApp + Instagram customer-service window
  }
};

function whatsappReady() { return !!(config.meta.whatsapp.phoneNumberId && config.meta.whatsapp.token); }
function instagramReady() { return !!(config.meta.instagram.igUserId && config.meta.instagram.token); }
function llmReady() { return config.llm.provider === 'mock' || !!config.llm.apiKey; }
function webhookReady() { return !!config.meta.appSecret; }

module.exports = { config, whatsappReady, instagramReady, llmReady, webhookReady };
