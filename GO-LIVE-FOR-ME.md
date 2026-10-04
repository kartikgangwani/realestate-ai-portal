# 🚀 GO-LIVE-FOR-ME — Apne liye setup (personal use)

Ye guide tumhare **apne** WhatsApp/Instagram ko is portal se jodne ke liye hai.
Personal use ka sabse bada fayda: **Meta ka App Review nahi chahiye** — wo tab lagta hai jab tum *doosron* ke accounts jodo. Apne accounts = **development mode + free test number** = aaj hi shuru.

---

## ⚡ Sabse pehle: sach

| Cheez | Reality |
|---|---|
| **App Review** | ❌ Tumhare apne account ke liye **nahi chahiye** |
| **Cost (replies)** | ✅ Customer ka message aane ke 24 ghante ke andar reply = **FREE** (service messages) |
| **Cost (template blast)** | 💸 Marketing template = per message paisa lagta hai |
| **Number chahiye** | Ek **alag SIM/number** jo abhi kisi WhatsApp pe active na ho (₹150-300) |
| **Verification** | Unverified se bhi **250 naye chats/day** — shuruat ke liye kaafi. Baad me Meta Business verification (2-5 din) |
| **Instagram** | Professional account + "Allow access to messages" ON. App review tab tak nahi chahiye jab tak sirf tumhara account ho |

---

## 📋 STEP 1 — Accounts (aaj, 20 min)

1. **business.facebook.com** → Meta Business account banao (free)
2. **developers.facebook.com** → "My Apps" → **Create App** → type: **Business**
3. App ke andar → **Add Product** → **WhatsApp** → *Set up*
4. Meta ek **free test number** dega + **temporary token**. Turant 5 recipients tak test kar sakte ho.
   *(Test number ke saath khel lo pehle — asli number baad me add karo.)*

**Number note:** asli number add karna ho to wo SIM **kisi WhatsApp app pe active nahi honi chahiye**. Naya SIM lo, ya purana number WhatsApp se delete karke 30 min baad API pe daalo.

---

## 📋 STEP 2 — Tokens nikalo

| Variable | Kahan milega |
|---|---|
| `WHATSAPP_PHONE_NUMBER_ID` | App → WhatsApp → API Setup → "Phone number ID" |
| `WHATSAPP_TOKEN` | API Setup → Temporary token (**24 ghante chalta hai** → permanent ke liye System User token banao: Business Settings → Users → System Users → Generate token, `whatsapp_business_messaging` permission) |
| `WHATSAPP_VERIFY_TOKEN` | Khud ka koi random string likho (jaise `kartik-lucky-2026`) |
| `META_APP_SECRET` | App → Settings → Basic → App Secret |
| `IG_USER_ID` + `IG_TOKEN` | Instagram tab (agar Insta bhi jodna hai) |

**Instagram jodne ke liye:** Instagram app → Settings → Account type → **Professional**. Phir → Messages and story replies → Message controls → **Allow access to messages** ON. *(Ye off ho to webhook chup-chaap kaam nahi karega — sabse common mistake.)*

---

## 📋 STEP 3 — Server online karo (webhook ke liye public URL chahiye)

### Option A: Railway (production-ish, recommended)
1. Tumhara repo private rakho, Railway → **Deploy from GitHub**
2. `+ New` → **Database** → **PostgreSQL**
3. **Variables** me daalo (`.env.example` dekh ke):
```
APP_MODE=LIVE
ALLOW_LIVE=YES-I-UNDERSTAND
APPROVAL_REQUIRED=true
DATABASE_URL=<Railway auto deta hai>
SESSION_SECRET=<32+ random>
ADMIN_USERNAME=portaladmin
ADMIN_PASSWORD=<14+ strong password>
META_APP_SECRET=<app secret>
WHATSAPP_PHONE_NUMBER_ID=<id>
WHATSAPP_TOKEN=<token>
WHATSAPP_VERIFY_TOKEN=<tumhara random string>
LLM_PROVIDER=openai          # ya anthropic / mock
LLM_API_KEY=<key>
LLM_MODEL=gpt-4o-mini
NODE_ENV=production
```
4. Deploy → URL milega: `https://<app>.up.railway.app`

### Option B: Laptop pe test (ngrok)
```bash
# terminal 1
node --env-file=.env server.js
# terminal 2
ngrok http 3000      # public URL milega, jaise https://abc123.ngrok-free.app
```
⚠️ Laptop band = bot band. Sirf testing ke liye.

---

## 📋 STEP 4 — Meta ko webhook batao

Meta App → **WhatsApp → Configuration** → Webhook → "Edit":

| Field | Value |
|---|---|
| Callback URL | `https://<tumhara-url>/api/webhooks/whatsapp` |
| Verify token | wahi `WHATSAPP_VERIFY_TOKEN` |

**Verify and save** dabao — hare tick aana chahiye. Phir **Subscribe** karo field: **`messages`** ✅

*(Instagram ke liye: Instagram → Webhooks → `https://<url>/api/webhooks/instagram`, same verify token, subscribe `messages`.)*

---

## 📋 STEP 5 — Pehla live test 🎉

1. Apne **personal phone** se us number pe WhatsApp karo: *"Hi, 2BHK Jaipur me chahiye"*
2. Portal kholo → **Inbox** tab
3. Dekho: **AI ne draft bana diya hoga** ✨ (status: `draft`)
4. Draft padho → theek lage to **✅ Approve & send** → message chala jayega
   *(LIVE mode me real send hota hai; TEST mode me sirf dry-run)*
5. Customer ka jawab aaya → naya draft ready → approve → repeat

**Bas!** Tumhara AI agent live hai — aur har message insaan (tum) ke approve karne ke baad hi jaata hai.

---

## 🧪 Abhi, bina kisi account ke test karna ho toh

Demo/LIVE ke bina bhi pura flow chalta hai:
```bash
APP_MODE=TEST LLM_PROVIDER=mock node --env-file=.env server.js
```
- **Inbox** tab → "AI se draft banao" → Approve → `dry_run` (message nahi jaata, sirf logged)
- Webhook simulate karke dekho:
```bash
curl -X POST http://localhost:3000/api/webhooks/whatsapp \
  -H 'Content-Type: application/json' \
  -d '{"object":"whatsapp_business_account","entry":[{"changes":[{"value":{"contacts":[{"profile":{"name":"Test"},"wa_id":"919876500111"}],"messages":[{"from":"919876500111","id":"wamid.1","timestamp":"1759600000","type":"text","text":{"body":"Sir price kya hai?"}}]}}]}]}'
```

---

## 💰 Monthly cost estimate (personal use)

| Item | Cost |
|---|---|
| Meta Cloud API | ₹0 platform fee |
| Customer replies (24h window) | **₹0** (free service messages) |
| Marketing templates (agar bhejo) | ~₹0.7–0.9 per message (India) |
| Railway server + Postgres | ~$5/month |
| LLM (OpenAI gpt-4o-mini) | 1000 drafts ≈ ₹15–30 |
| **Total (sirf replies)** | **≈ ₹450–500/month** |

---

## ⚠️ Rules jo todne pe number band ho jaata hai

1. ❌ **Cold blast nahi** — sirf unhe reply jo tumhe message karein (ya jinhone opt-in diya)
2. ❌ **24h window ke baad** free-form message nahi — template chahiye
3. ❌ **HUMAN_AGENT tag AI ke liye nahi** — code khud mana kar deta hai
4. ❌ **Spam report** = quality rating down = number ban. Isliye approval queue kabhi off mat karo
5. 📄 India: DPDP Act — customer data ka purpose batao, consent record rakho (contacts table me `consent_source` + `consent_at` isliye hai)

---

## 🔧 Troubleshooting

| Problem | Wajah / Fix |
|---|---|
| Webhook verify fail | `WHATSAPP_VERIFY_TOKEN` mismatch, ya URL me `/api/webhooks/whatsapp` galat |
| Message nahi jaata, "blocked" | 24h window band (customer ne last 24h me message nahi kiya) — normal hai, ya consent missing |
| Error **131047** | Re-engagement window closed → approved template bhejo |
| Error **190** | Token expire (temporary token 24h) → System User permanent token banao |
| Instagram webhook chup | "Allow access to messages" OFF hai Instagram app me |
| Signature verification fail | `META_APP_SECRET` galat, ya proxy body modify kar raha hai |

---

## 🧩 Aage kya add kar sakte ho (optional)

- [ ] **Naya unknown number aaya** → auto-lead banao (abhi manual link karna padta hai)
- [ ] **Voice note / image** handling (abhi sirf text)
- [ ] **Template manager** — approved templates UI se bhejo
- [ ] Chat-style inbox (abhi outbox list hai)
- [ ] Reminders: "3 din se jawab nahi aaya → follow-up draft banao"

---

**Yaad rakho:** ye system tumhara **receptionist** hai, spam machine nahi. Wo 24/7 sunta hai, draft banata hai — bhejne ka decision tumhara. Yahi wo design hai jo **saal bhar chalta hai** aur ban nahi hota. 💪
