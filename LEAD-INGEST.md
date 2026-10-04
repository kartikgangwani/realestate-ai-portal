# 📥 LEAD-INGEST — Portal ke leads apne CRM me laao (bina API)

**Sawal:** "CRM site se integrated nahi hai, to lead scrape kaise karein?"
**Jawab:** Scrape **nahi** karte. Ho jaata hai — **tumhare hi notification emails pakad ke.** 👇

---

## 🧠 Pehle concept clear: "scrape" vs "capture"

| | ❌ Portal scraping | ✅ Lead capture (ye system) |
|---|---|---|
| **Kya uthate ho** | Portal se **doosron ke** listings/leads/numbers | **Tumhare** leads jo tumhe **already** aate hain |
| **Kaun se data** | Unka database | Tumhara apna inbox |
| **Allowed?** | ❌ ToS violation + DPDP risk + ban | ✅ 100% legit — **yehi har Indian CRM karta hai** |
| **Stable?** | Kabhi bhi band (portal block karega) | Hamesha chalega (email tumhara hai) |

**Asli baat:** Jab tum 99acres/MagicBricks ka subscription lete ho, har lead ka **email notification tumhare inbox me aata hai** — naam, phone, budget, requirement sab ke saath. Bas us email ko padhke CRM me daalna hai. Wahi ye system karta hai.

*(Sell.do, PropFlo, LeadSquared — sab yahi "email parsing" wala rasta use karte hain. Ye industry standard hai.)*

---

## ⚡ 3 tarike — jo aasan lage wo chuno

### 🅰️ Option A: Copy-paste (aaj hi, 5 second)

Portal kholo → Inbox tab → **"Lead ingest"** card → email paste karo → **"Parse + CRM me daalo"**

System khud nikaal lega: naam, phone, budget, type, location, timeline, reference. Duplicate bhi check karega.

**Kab use karo:** jab roz 1-5 leads aati hain, ya testing ke liye.

---

### 🅱️ Option B: Gmail auto-forwarder (recommended — 100% automatic) 🏆

Gmail use karte ho? Ek **Apps Script** paste karo, bas. **Har 15 minute me** portal emails khud CRM me aa jayengi.

**Setup (10 minute):**

1. **Kholo:** [script.google.com](https://script.google.com) → **New project**
2. Neeche wala code paste karo:

```javascript
// ── RealEstate AI — Gmail → CRM lead forwarder ──
function forwardPortalLeads() {
  const INGEST_URL = 'https://<TUMHARA-APP>.up.railway.app/api/leads/ingest';
  const TOKEN      = '<TUMHARA LEAD_INGEST_TOKEN>';

  // Kaunse emails uthane hain (apne portals add/remove karo)
  const QUERY = 'from:(99acres.com OR magicbricks.com OR housing.com OR nobroker.in OR commonfloor.com) newer_than:2d';

  const props = PropertiesService.getScriptProperties();
  const threads = GmailApp.search(QUERY, 0, 25);   // ek run me max 25 threads

  let sent = 0;
  threads.forEach(function (thread) {
    thread.getMessages().forEach(function (msg) {
      const key = 'seen:' + msg.getId();
      if (props.getProperty(key)) return;          // pehle bhej chuke hain

      const payload = {
        email: {
          subject: msg.getSubject(),
          from: msg.getFrom(),
          text: msg.getPlainBody()
        }
      };

      const res = UrlFetchApp.fetch(INGEST_URL, {
        method: 'post',
        contentType: 'application/json',
        headers: { 'X-Ingest-Token': TOKEN },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      if (res.getResponseCode() < 300) {
        props.setProperty(key, '1');               // mark as done
        sent++;
      } else {
        Logger.log('FAILED ' + res.getResponseCode() + ': ' + res.getContentText());
      }
    });
  });
  Logger.log('Forwarded ' + sent + ' lead email(s).');
}

// ── Ek baar test karne ke liye ye chalao ──
function testOnce() { forwardPortalLeads(); }
```

3. Code save karo (💾) → **Run** dabao → Google permission maangega (**Allow**)
4. **Automatic karne ke liye:** left sidebar → ⏰ **Triggers** → **Add Trigger**:
   - Function: `forwardPortalLeads`
   - Event source: **Time-driven**
   - Interval: **Minutes timer → Every 15 minutes**
   - Save ✅

**Bas!** Ab portal ka email aaya → 15 min me CRM me lead pahunch jayegi → auto follow-up ban jayega → tum call kar lo.

⚠️ **`TOKEN` ko script me daalna hai** (server ke `.env` ke `LEAD_INGEST_TOKEN` se match karna chahiye). Script tumhare Google account me private hota hai — kisi aur ko share mat karo.

**Gmail ke alawa:** Outlook/Zoho? Same kaam "email forwarding rule → Zapier/Make webhook" se hota hai (Option C).

---

### 🅲 Option C: Zapier / Make (no-code, koi bhi email provider)

1. Zapier → **New Zap** → Trigger: **Email Parser** (ya "Gmail: New Email")
2. Filter: `From contains 99acres.com` (ya MagicBricks)
3. Action: **Webhooks by Zapier → POST**
   - URL: `https://<tumhara-app>/api/leads/ingest`
   - Headers: `X-Ingest-Token: <tumhara token>`
   - Payload (JSON): `{"email": {"subject": "{{subject}}", "from": "{{from}}", "text": "{{body_plain}}"}}`
4. Test → Turn on

**Cost:** Zapier free tier me 100 tasks/month (zara se zyada leads ke liye paid). Make.com sasta hai.

---

## 🔧 API reference (apna script likhna ho to)

### `POST /api/leads/ingest` — machine route (token auth)

```bash
curl -X POST https://<app>/api/leads/ingest \
  -H 'Content-Type: application/json' \
  -H 'X-Ingest-Token: <TUMHARA_LEAD_INGEST_TOKEN>' \
  -d '{
    "email": {
      "subject": "New Lead: 3 BHK Apartment in Vaishali Nagar, Jaipur",
      "from": "noreply@99acres.com",
      "text": "Name: Rahul Sharma\nMobile: +91 98765 43210\nBudget: 75 Lakh - 90 Lakh\n..."
    }
  }'
```

**Response:**
```json
{
  "status": "accepted",
  "source": "99acres",
  "leadId": "L-021",
  "score": 85,
  "followupId": "F-08",
  "consentRecorded": true,
  "confidence": 100,
  "note": "Lead L-021 ban gaya, follow-up F-08 create hua, consent record ho gaya."
}
```

**Duplicate aaya to:**
```json
{ "status": "duplicate", "existingLeadId": "L-021", "note": "Pehle se maujood hai (phone match) — lead L-021" }
```

**Parsed lead seedha bhejna ho** (Zapier me zaada control chahiye to):
```json
{ "lead": { "name": "...", "phone": "9876543210", "propertyType": "3 BHK", "location": "Jaipur", "budget": { "min": 7500000, "max": 9000000 }, "source": "99acres" } }
```

### `POST /api/leads/parse` — sirf preview (session + CSRF)
Email bhejo, parsed JSON milega. **Kuch save nahi hota.** UI ke "Preview" button se yahi chalta hai.

### `GET /api/leads/ingest-log` — kya-kya aaya (session)
Pichhle 30 ingest events: accepted / duplicate / error, confidence ke saath.

---

## 🧬 Kya nikaalta hai parser (aur kahan store hota hai)

| Field | Kahan jaata hai | Note |
|---|---|---|
| Name, type, location, budget, timeline, score | **app_state** (leads) | CRM data |
| **Phone number** | **contacts** table (alag) | Consent ke saath — app_state me kabhi nahi |
| Consent (`consent_source`, `consent_at`) | **contacts** | `portal-enquiry:<source>` |
| Follow-up task | **app_state** (followups) | "Call karke requirement confirm karo" |
| Poora audit log | **lead_ingest_log** | Duplicate detection ke liye bhi |

**Kyun phone alag table me?** Do wajah: (1) Test Mode guard waise hi kaam karta rehta hai (app_state me real numbers allowed nahi), (2) messaging layer sirf `contacts` padhti hai — clean separation.

**Dedupe kaise:** phone (last 10 digits) → email → portal reference ID. Match mila to naya lead nahi banta, duplicate log hota hai.

**Masked numbers:** portals often `98XXXXXX12` bhejte hain. Parser use detect karke `phoneMasked: true` mark karta hai, aur follow-up likhta hai: *"Portal kholo aur number dekho, phir call karo."* (Ye normal hai — portal chahta hai ki tum unka dashboard kholo 😄)

---

## ⚠️ Legal / ethical line (ye clear rakho)

**✅ Karo:**
- Apne paid subscription ke leads ko apne CRM me laao
- Apni website/app ke forms ke leads
- Jo customer ne khud tumhe diya

**❌ Mat karo:**
- Portals se **doosron ke** listings/leads/owner details scrape karna (ToS violation + DPDP Act problem)
- Lead data **bechna ya share karna** (tumhara subscription agreement bhi yahi kehta hai — apne contract me padh lo)
- Browser extensions/"secret API" jo portal ke andar ghuske data nikaalte hain — ban + legal notice ka risk
- Ek hi lead ko 10 CRMs me daal ke sab jagah se message karna

**Sabse safe rule:** jo lead **tumhe** aayi hai, wo **tumhari** hai. Jo tumne churai, wo nahi.

---

## 🧪 Test karna (bina kisi portal ke)

Workspace ke live preview me: **Inbox → Lead ingest** → koi bhi sample email paste karo:

```
Subject: New Lead: 3 BHK Apartment in Vaishali Nagar, Jaipur
From: noreply@99acres.com

Name: Rahul Sharma
Mobile: +91 98765 43210
Budget: 75 Lakh - 90 Lakh
Message: Please contact me soon
Lead ID: 99A-12345678
```

**"👁 Preview"** → parser kya-kya nikaal raha hai wo dikhega
**"📥 Parse + CRM me daalo"** → lead + follow-up + consent ban jayega
**Leads tab** → naya lead dikhega (score ke saath)
**Dubara paste karo** → "Duplicate mila" — dedupe kaam kar raha hai ✅

---

## 🛠 Troubleshooting

| Problem | Fix |
|---|---|
| `503 Lead ingest is disabled` | `.env` me `LEAD_INGEST_TOKEN` set karo, server restart |
| `401 Invalid ingest token` | Header ka token `.env` se match nahi kar raha |
| Lead ban gaya par phone nahi | Portal ne number mask kiya (`98XXXXXX12`) — portal dashboard khol ke dekho, phir contact manually link karo |
| Duplicate bol raha hai par naya hai | Us number/email se pehle koi lead aa chuki thi — `ingest-log` dekho |
| Gmail script error 302/401 | Token galat, ya URL me `/api/leads/ingest` missing |
| Budget galat aaya | Portal ka format naya hai — email paste karke Preview me dekho, phir parser ke pattern me add kar denge |

---

## 🗺 Aage kya (agar chaho)

- [ ] **IMAP poller** — bina Gmail ke bhi server khud mailbox padhe (`imapflow` dependency ke saath). Abhi Gmail Apps Script kaam kar deta hai.
- [ ] **WhatsApp template auto-send** — portal lead ke liye approved utility template (Meta rule: window band hai to template hi option hai)
- [ ] **Auto-call reminder** — "2 ghante me call nahi kiya to escalate"
- [ ] **Portal-wise templates** — 99acres/MagicBricks ke naye email format ke liye parser profiles

---

**Yaad rakho:** tumhara system ab **teen darwaze** se lead leta hai — portal emails (ye), website form (ingest webhook), aur WhatsApp/Instagram (webhook). Teenon ek hi CRM me. **Kisi portal ki API ki zaroorat nahi.** 💪
