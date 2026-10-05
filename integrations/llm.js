'use strict';

const { fetchJson } = require('./http');

// Provider-agnostic LLM adapter.
// Supports any OpenAI-compatible endpoint (OpenAI, Groq, Together, local mock…)
// and Anthropic's Messages API. No vendor SDK needed.
function createLLM(config) {
  const llm = config.llm;

  // Offline provider: deterministic templated drafts so the whole pipeline
  // (webhook -> AI draft -> human approval -> dry run) can be tested with zero accounts.
  function mockChat(messages, { json = false } = {}) {
    const joined = messages.map((m) => String(m.content || '')).join('\n');
    if (json) {
      const lower = joined.toLowerCase();
      const intent = /price|rate|kitna|kitne|budget|cost/.test(lower) ? 'price'
        : /visit|dekhna|dikhana|dikhao|site/.test(lower) ? 'visit'
        : /complaint|problem|issue|shikayat/.test(lower) ? 'complaint'
        : 'enquiry';
      const typeMatch = joined.match(/Requirement:\s*([^,\n]+?)(?:\s+in\s+|,|\n)/);
      const locationMatch = joined.match(/in\s+([A-Za-z ]+?)(?:,|\s+budget|\n)/);
      return JSON.stringify({
        intent,
        propertyType: typeMatch ? typeMatch[1].trim() : null,
        location: locationMatch ? locationMatch[1].trim() : null,
        budgetInr: null,
        urgency: 'medium',
        language: /[\u0900-\u097F]/.test(joined) ? 'hindi' : 'hinglish',
        _provider: 'mock'
      });
    }
    const lead = {
      name: (joined.match(/Lead name:\s*([^\n]+)/) || [, 'Customer'])[1].trim(),
      type: (joined.match(/Requirement:\s*([^,\n]+?)(?:\s+in\s+|,|\n)/) || [, 'property'])[1].trim(),
      location: (joined.match(/in\s+([A-Za-z ]+?)(?:,\s*budget|\n)/) || [, 'aapke area'])[1].trim(),
      timeline: (joined.match(/timeline\s+([^,\n]+)/) || [, ''])[1].trim()
    };
    const inbound = (joined.match(/Customer message:\s*"([^"]*)"/) || [, ''])[1];
    const wantsVisit = /visit|dekh|dikhao|site/i.test(inbound);
    const wantsPrice = /price|rate|kitna|kitne|budget|cost/i.test(inbound);
    const opening = lead.name && lead.name !== 'Customer' ? `Namaste ${lead.name.split(' ').slice(-1)[0]} ji!` : 'Namaste!';
    const line = wantsVisit
      ? `Aap ${lead.type} ${lead.location} mein dekhna chahte hain — main do options ready kar deta hoon, kaunsa din theek rahega?`
      : wantsPrice
        ? `Aapki ${lead.type} requirement note kar li hai. Exact price bhejne se pehle ek baat batayein — aap kitne BHK/area dekh rahe hain?`
        : `Aapki ${lead.type} ${lead.location} wali enquiry mil gayi hai. Sahi options nikalne ke liye 2 minute baat kar sakte hain?`;
    return `[Mock AI draft] ${opening} ${line}`;
  }

  async function chat(messages, { json = false, maxTokens = 500, temperature = 0.3 } = {}) {
    if (llm.provider === 'mock') return mockChat(messages, { json });
    if (!llm.apiKey) throw new Error('LLM is not configured (LLM_API_KEY missing, or set LLM_PROVIDER=mock).');

    if (llm.provider === 'anthropic') {
      const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
      const rest = messages.filter((m) => m.role !== 'system');
      const result = await fetchJson(`${llm.baseUrl}/messages`, {
        method: 'POST',
        headers: { 'x-api-key': llm.apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: llm.model, max_tokens: maxTokens, temperature, system, messages: rest })
      });
      if (!result.ok) throw new Error(`LLM failed (${result.status}): ${JSON.stringify(result.body).slice(0, 300)}`);
      const text = (result.body?.content || []).map((part) => part.text || '').join('').trim();
      return text;
    }

    const result = await fetchJson(`${llm.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${llm.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: llm.model, temperature, max_tokens: maxTokens, messages,
        ...(json ? { response_format: { type: 'json_object' } } : {})
      })
    });
    if (!result.ok) throw new Error(`LLM failed (${result.status}): ${JSON.stringify(result.body).slice(0, 300)}`);
    return (result.body?.choices?.[0]?.message?.content || '').trim();
  }

  const HOUSE_RULES = [
    'You are the messaging assistant for an Indian real-estate brokerage.',
    'Rules: reply in the language the customer used (Hindi in Latin script, English, or Hinglish).',
    'Keep it under 60 words. One clear question at the end. Never invent prices, availability, or legal claims.',
    'Never promise a site visit confirmation before a human approves it. No emojis overload (max one).'
  ].join('\n');

  async function draftReply({ lead, inbound, channel, languageHint = '' }) {
    const content = await chat([
      { role: 'system', content: HOUSE_RULES },
      { role: 'user', content: [
        `Channel: ${channel}`,
        `Lead name: ${lead?.name || 'Customer'}`,
        `Requirement: ${lead?.type || 'unknown'} in ${lead?.location || 'unknown'}, budget ${lead?.budget || 'unknown'} INR, purpose ${lead?.purpose || 'unknown'}, timeline ${lead?.timeline || 'unknown'}`,
        `Customer message: "${inbound || ''}"`,
        languageHint ? `Language hint: ${languageHint}` : '',
        'Write ONLY the reply text. No preamble, no quotes.'
      ].filter(Boolean).join('\n') }
    ], { maxTokens: 220, temperature: 0.4 });
    return content.replace(/^["']|["']$/g, '').trim();
  }

  // Extract structured requirement data from a free-text message.
  async function classify(text) {
    const raw = await chat([
      { role: 'system', content: 'Extract real-estate enquiry data. Reply with JSON only, keys: intent (enquiry|price|visit|complaint|other), propertyType, location, budgetInr (number or null), urgency (high|medium|low), language (hindi|english|hinglish).' },
      { role: 'user', content: text || '' }
    ], { json: true, maxTokens: 200, temperature: 0 });
    try { return JSON.parse(raw); } catch (_) { return { intent: 'other', parseError: true, raw: raw.slice(0, 200) }; }
  }

  return { chat, draftReply, classify };
}

module.exports = { createLLM };
