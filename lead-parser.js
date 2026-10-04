'use strict';

// Portal lead-email parser.
// Turns the lead notification emails that arrive in YOUR own inbox
// (99acres / MagicBricks / Housing / NoBroker / generic) into structured lead data.
// It never touches the portals themselves — only emails you already receive.

const PORTAL_SENDERS = [
  { match: /99acres/i, source: '99acres' },
  { match: /magicbricks/i, source: 'MagicBricks' },
  { match: /housing\.com|housingcom/i, source: 'Housing.com' },
  { match: /nobroker/i, source: 'NoBroker' },
  { match: /olx/i, source: 'OLX' },
  { match: /proptiger/i, source: 'PropTiger' },
  { match: /squareyards/i, source: 'SquareYards' },
  { match: /commonfloor/i, source: 'CommonFloor' }
];

const MASKED_PHONE = /(?:\+?91[\s-]?)?(?:[6-9](?:[\dXx*]{1,4}){1,2}[\dXx*]{4})/;

function stripHtml(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#8377;|&rupee;/gi, '\u20b9')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function detectSource({ from = '', subject = '', text = '' }) {
  const haystack = `${from} ${subject} ${text.slice(0, 800)}`;
  for (const entry of PORTAL_SENDERS) {
    if (entry.match.test(haystack)) return entry.source;
  }
  return 'email';
}

// Indian mobile: 10 digits starting 6-9, optionally with +91 / 0 prefix.
function extractPhone(text, { allowMasked = true } = {}) {
  const clean = text.replace(/[()]/g, ' ');
  const labelled = clean.match(/(?:mobile|phone|contact(?:\s*(?:no|number))?)\s*[:\-\u2013]?\s*((?:\+?91[\s-]?|0)?[6-9][\d\s-]{8,14}\d)/i);
  const candidates = [];
  if (labelled) candidates.push(labelled[1]);
  const any = clean.match(/(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}/g) || [];
  candidates.push(...any);

  for (const raw of candidates) {
    const digits = String(raw).replace(/\D/g, '');
    const last10 = digits.length > 10 ? digits.slice(-10) : digits;
    if (/^[6-9]\d{9}$/.test(last10)) return { value: last10, masked: false };
  }

  if (allowMasked) {
    const raw = (clean.match(new RegExp(MASKED_PHONE.source, 'i')) || [])[0];
    if (raw && /[Xx*]/.test(raw)) return { value: String(raw).trim(), masked: true };
  }
  return null;
}

function extractEmailAddr(text) {
  const found = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  if (!found) return null;
  const value = found[0];
  return { value, masked: /\*|x{2,}/i.test(value.split('@')[0]) };
}

function extractName(text) {
  const patterns = [
    /(?:contact\s*name|customer\s*name|name)\s*[:\-\u2013]\s*([A-Za-z][A-Za-z .]{1,40})/i,
    /(?:dear|hi|hello)\s+([A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+)?)\s*[,!]/,
    /(?:enquiry|inquiry)\s+(?:from|by)\s+([A-Za-z][A-Za-z .]{1,40})/i
  ];
  for (const pattern of patterns) {
    const hit = text.match(pattern);
    if (hit) {
      const value = hit[1].trim().replace(/\s{2,}/g, ' ');
      if (value.length > 1 && !/^(there|sir|madam|you|us|team)$/i.test(value)) return value;
    }
  }
  return null;
}

function toRupees(number, unit) {
  const n = Number(String(number).replace(/,/g, ''));
  if (!isFinite(n)) return null;
  const u = String(unit || '').toLowerCase();
  if (/^(cr|crore)/.test(u)) return Math.round(n * 10000000);
  if (/^(l|lac|lakh)/.test(u)) return Math.round(n * 100000);
  if (/^(k|thousand)/.test(u)) return Math.round(n * 1000);
  return Math.round(n);
}

function extractBudget(text) {
  const range = text.match(/(?:budget|price|value)[^\d\u20b9]{0,12}\u20b9?\s*([\d,.]+)\s*(cr|crore|lakh|lac|l|k)?\s*(?:-|\u2013|to)\s*\u20b9?\s*([\d,.]+)\s*(cr|crore|lakh|lac|l|k)?/i);
  if (range) {
    // Unit sirf ek number pe likha ho to doosre pe bhi apply karo ("45 - 55 Lakh")
    const unit = range[2] || range[4] || '';
    const low = toRupees(range[1], range[2] || unit);
    const high = toRupees(range[3], range[4] || unit);
    if (low && high) return { min: Math.min(low, high), max: Math.max(low, high), raw: range[0].trim() };
  }
  const single = text.match(/(?:budget|price|value)[^\d\u20b9]{0,12}\u20b9?\s*([\d,.]+)\s*(cr|crore|lakh|lac|l|k)\b/i);
  if (single) {
    const value = toRupees(single[1], single[2]);
    if (value) return { min: value, max: value, raw: single[0].trim() };
  }
  const shorthand = text.match(/([\d.]+)\s*(?:l|lakh|lac)\b/i);
  if (shorthand) {
    const value = toRupees(shorthand[1], 'lakh');
    if (value && value >= 500000) return { min: value, max: value, raw: shorthand[0].trim() };
  }
  return null;
}

function extractRequirement(text) {
  const bhk = text.match(/(\d)\s*(?:bhk|bedroom)/i);
  const typeWords = /\b(apartment|flat|villa|plot|land|office|shop|showroom|warehouse|independent house|builder floor|penthouse|studio)\b/i;
  const typeHit = text.match(typeWords);
  let propertyType = null;
  if (bhk) {
    const kind = typeHit ? typeHit[0].replace(/\b\w/g, (c) => c.toUpperCase()) : '';
    propertyType = `${bhk[1]} BHK${kind && !/^\d/.test(kind) ? ' ' + kind : ''}`;
  } else if (typeHit) propertyType = typeHit[0].replace(/\b\w/g, (c) => c.toUpperCase());

  let location = null;
  const locPatterns = [
    /(?:property|requirement|looking\s+(?:for|in)|in)\s*[:\-]?\s*([A-Z][A-Za-z .]{2,30}),\s*(Jaipur|Mumbai|Delhi|Bengaluru|Bangalore|Pune|Hyderabad|Chennai|Gurgaon|Noida|Ahmedabad|Kolkata)/,
    /\|\s*([A-Z][A-Za-z .]{2,30}),\s*([A-Z][A-Za-z]{3,15})/
  ];
  for (const pattern of locPatterns) {
    const hit = text.match(pattern);
    if (hit) { location = `${hit[1].trim()}, ${hit[2].trim()}`; break; }
  }
  if (!location) {
    const city = text.match(/\b(Jaipur|Mumbai|Delhi|Bengaluru|Bangalore|Pune|Hyderabad|Chennai|Gurgaon|Noida|Ahmedabad|Kolkata)\b/i);
    if (city) location = city[1];
  }

  const timelineHit = text.match(/(immediate(?:ly)?|within\s+\d+\s*(?:day|week|month)s?|\d+\s*[-\u2013]\s*\d+\s*months?|next\s+\d+\s*months?)/i);
  const timeline = timelineHit ? timelineHit[1] : null;

  const purpose = /\b(rent|rental|lease|for rent|kiraya)\b/i.test(text) ? 'Rental'
    : /\binvest(?:ment|or)?\b/i.test(text) ? 'Investment'
    : /\b(self[- ]?use|to live|own use|family)\b/i.test(text) ? 'Self-use'
    : null;

  return { propertyType, location, timeline, purpose };
}

function extractReference(text) {
  const patterns = [
    /(?:lead|enquiry|inquiry)\s*(?:id|no|number)\s*[:\-#]?\s*([A-Z0-9-]{5,20})/i,
    /(?:property)\s*(?:id|ref(?:erence)?|code)\s*[:\-#]?\s*([A-Z0-9-]{4,20})/i
  ];
  for (const pattern of patterns) {
    const hit = text.match(pattern);
    if (hit) return hit[1].toUpperCase();
  }
  return null;
}

function extractMessage(text) {
  const hit = text.match(/(?:message|remarks?|comments?|requirement details?)\s*[:\-\u2013]\s*([^\n]{5,300})/i);
  return hit ? hit[1].trim() : null;
}

function parseLeadEmail({ subject = '', from = '', text = '', html = '', receivedAt = null } = {}) {
  const plain = [stripHtml(html), String(text || '')].filter(Boolean).join('\n');
  const body = `${subject}\n${plain}`.trim();

  const source = detectSource({ from, subject, text: body });
  const phone = extractPhone(body);
  const email = extractEmailAddr(body);
  const name = extractName(body) || (source !== 'email' ? `Portal lead (${source})` : 'Email lead');
  const budget = extractBudget(body);
  const requirement = extractRequirement(body);
  const reference = extractReference(body);
  const message = extractMessage(body);

  const matched = ['name', 'phone', 'email', 'budget', 'requirement', 'reference', 'message']
    .filter((key) => {
      if (key === 'name') return name && !/^Portal lead|^Email lead/.test(name);
      if (key === 'phone') return !!phone;
      if (key === 'email') return !!email;
      if (key === 'budget') return !!budget;
      if (key === 'requirement') return !!(requirement.propertyType || requirement.location);
      if (key === 'reference') return !!reference;
      return !!message;
    });

  const confidence = Math.min(100, matched.length * 14 + (phone && !phone.masked ? 20 : 0) + (budget ? 8 : 0));

  return {
    source,
    name,
    phone: phone ? phone.value : null,
    phoneMasked: phone ? phone.masked : false,
    phoneE164: phone && !phone.masked ? '+91' + phone.value : null,
    email: email ? email.value : null,
    emailMasked: email ? email.masked : false,
    budget,
    ...requirement,
    reference,
    message,
    confidence,
    matchedFields: matched,
    receivedAt: receivedAt || new Date().toISOString(),
    rawExcerpt: body.slice(0, 400)
  };
}

module.exports = { parseLeadEmail, stripHtml, extractPhone, extractBudget };
