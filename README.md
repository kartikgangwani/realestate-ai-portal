# 🏠 RealEstate AI — Private Test Mode Portal

A **self-contained real-estate lead management portal** with a 10-agent workflow dashboard.
Deliberately locked to **Test Mode**: it runs on dummy data only and never contacts anyone.

[![Node](https://img.shields.io/badge/node-%E2%89%A520-339933)](#) [![Postgres](https://img.shields.io/badge/postgres-%E2%89%A514-31648C)](#) [![Mode](https://img.shields.io/badge/mode-TEST%20ONLY-orange)](#) [![License](https://img.shields.io/badge/license-MIT-blue)](#license)

---

## What it does

A private, login-protected workspace for practising and demonstrating a real-estate sales workflow end to end:

| Screen | What it shows |
|---|---|
| **Dashboard** | Live snapshot: HOT leads, available inventory, due follow-ups, pending site visits, agent activity |
| **Test Leads** | 20 dummy leads with source, requirement, budget, purpose, timeline, priority score, DNC flag |
| **Properties** | 10 dummy properties with type, location, price, status (Available / On Hold / Sold) |
| **Follow-ups** | Internal task queue with owners and due labels |
| **Site Visits** | Visit proposals with status tracking |
| **AI Agents** | 10 simulated agents (Lead Capture → Property Matching → AI Sales Manager) with on/off control and audit log |
| **Reports** | Pipeline summary, source mix, score tiers |

Core logic: **lead scoring** (HOT ≥ 80, WARM ≥ 50, COLD below), **requirement matching** (type + availability),
**follow-up queueing**, **DNC protection** (Do-Not-Contact leads are excluded from everything), and an **activity audit log**.

> ⚠️ **The "AI" is rule-based simulation** — no LLM provider, no messaging, no calling.
> Every agent action writes an internal log entry only. This is intentional.

---

## Security model

Built as a "safe skeleton" — the security work is done, the risky integrations are left out on purpose.

- ✅ **Password storage:** scrypt with per-user salt
- ✅ **Sessions:** random 32-byte tokens; only an HMAC-SHA256 hash is stored in PostgreSQL; HTTP-only, SameSite=Strict cookies
- ✅ **CSRF:** server-issued token required on every mutating request
- ✅ **Login throttling:** 10 attempts / 10 minutes per IP
- ✅ **Security headers:** CSP, nosniff, DENY framing, no-store, restrictive Permissions-Policy
- ✅ **Static serving hardened:** no path traversal; only `public/` is served; 1 MB request cap
- ✅ **Test Mode guards:** app refuses to boot unless `APP_MODE=TEST`; state rejects contact-detail and credential fields (`phone`, `email`, `api_key`, …)
- ✅ **Boot-time validation:** strong `SESSION_SECRET` (≥ 32 chars) and `ADMIN_PASSWORD` (≥ 14 chars) enforced

---

## Quick start (local)

Requirements: **Node.js 20+** and **PostgreSQL 14+**.

```bash
cp .env.example .env      # set DATABASE_URL, SESSION_SECRET (32+ chars), ADMIN_USERNAME, ADMIN_PASSWORD
npm install
node --env-file=.env server.js
# → http://localhost:3000
```

The server creates its schema, the first TEST admin account, and seeds dummy data automatically on first boot.

Health check (used by Railway): `GET /api/health` → `{"status":"ok","mode":"TEST"}`

## Deploy (Railway)

1. New project → **Deploy from GitHub repo** (keep the repo **private**)
2. Add a **PostgreSQL** service — Railway injects `DATABASE_URL`
3. Add variables: `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `APP_MODE=TEST`, `NODE_ENV=production`
   *(never commit them; `.env` files are git-ignored)*
4. Deploy — `railway.toml` runs the Dockerfile and health-checks `/api/health`

---

## Project structure

```
├── server.js              # Zero-dependency HTTP server: routing, auth, sessions, CSRF, static files
├── db/schema.sql          # app_users, app_sessions, app_state (single JSONB row)
├── seed-state.json        # Dummy data: 20 leads, 10 properties, 10 agents, follow-ups, visits
├── public/                # Vanilla JS SPA (no build step): index.html, app.js, style.css
├── Dockerfile             # node:20-alpine, non-root user
├── railway.toml           # Railway build/deploy config
└── *.md                   # Security notes + deployment checklist
```

**Design choices:** one dependency (`pg`), no framework, no build step — it boots in under a second and is easy to audit.
State persists as a single JSONB row with optimistic whole-state saves (fine for Test Mode; see Limitations).

## API

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | — | Deployment health check |
| `POST` | `/api/auth/login` | — | Sign in → sets session cookie, returns CSRF token + state |
| `GET` | `/api/session` | cookie | Restore session |
| `POST` | `/api/auth/logout` | cookie + CSRF | Sign out |
| `PUT` | `/api/state` | cookie + CSRF | Save Test Mode state (validated) |
| `POST` | `/api/reset` | cookie + CSRF | Reset to seed data |

---

## Limitations (by design, for now)

- **No real integrations** — no WhatsApp, SMS, email, calling, payments, maps, or AI providers.
- Login throttle is **in-memory** (resets on restart) and keyed by socket IP — behind a proxy, all users may share one bucket.
  Production would move this to PostgreSQL and honour `X-Forwarded-For` correctly.
- Whole-state saves are last-write-wins: two simultaneous editors would overwrite each other.
- Single admin account; no roles, no per-user audit ownership yet.
- No automated test suite yet.

## Roadmap (if it becomes a real product)

- [ ] Integration layer behind a **human-approval queue** (nothing sends without review)
- [ ] Role-based access + per-user audit trail
- [ ] `X-Forwarded-For`-aware throttling, DB-backed rate limits
- [ ] Optimistic concurrency (version column) instead of whole-state overwrite
- [ ] Automated tests (auth, CSRF, Test Mode guards)
- [ ] Consent/compliance review **before** any outbound communication goes live

## License

MIT — see `LICENSE`. Educational / demo project. **Not financial, legal, or real-estate advice.**
