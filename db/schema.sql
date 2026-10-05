CREATE TABLE IF NOT EXISTS app_users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  csrf_token CHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS app_sessions_expiry_idx ON app_sessions (expires_at);

CREATE TABLE IF NOT EXISTS app_state (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  state JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by BIGINT REFERENCES app_users(id) ON DELETE SET NULL
);

-- ─────────────────────────────────────────────────────────────
-- Outbound messaging (added for the live-integration layer)
-- ─────────────────────────────────────────────────────────────

-- External handles (phone / IG id) live HERE, never inside app_state,
-- so the Test Mode guard on app_state keeps working unchanged.
CREATE TABLE IF NOT EXISTS contacts (
  id BIGSERIAL PRIMARY KEY,
  lead_id TEXT NOT NULL DEFAULT 'UNLINKED',
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'instagram')),
  handle TEXT NOT NULL,
  consent_source TEXT,
  consent_at TIMESTAMPTZ,
  last_inbound_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (channel, handle)
);

CREATE INDEX IF NOT EXISTS contacts_lead_idx ON contacts (lead_id, channel);

-- Approval queue: draft -> (human approves) -> sent | dry_run | blocked | rejected
CREATE TABLE IF NOT EXISTS outbox (
  id BIGSERIAL PRIMARY KEY,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'instagram')),
  lead_id TEXT NOT NULL,
  to_handle TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'reply' CHECK (kind IN ('reply', 'utility', 'marketing')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'blocked', 'rejected', 'dry_run', 'sent', 'failed')),
  ai_generated BOOLEAN NOT NULL DEFAULT FALSE,
  human_agent BOOLEAN NOT NULL DEFAULT FALSE,
  created_by TEXT NOT NULL DEFAULT 'system',
  blocked_reason TEXT,
  provider_message_id TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS outbox_status_idx ON outbox (status, created_at DESC);

-- Raw webhook audit trail (payloads only — no secrets stored here)
CREATE TABLE IF NOT EXISTS webhook_events (
  id BIGSERIAL PRIMARY KEY,
  channel TEXT NOT NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lead ingestion audit: every portal email / webhook lead that arrived
CREATE TABLE IF NOT EXISTS lead_ingest_log (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'unknown',
  dedupe_type TEXT NOT NULL DEFAULT 'none' CHECK (dedupe_type IN ('phone', 'email', 'reference', 'none')),
  dedupe_value TEXT NOT NULL DEFAULT '',
  lead_id TEXT,
  status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('accepted', 'duplicate', 'rejected', 'error')),
  confidence INT NOT NULL DEFAULT 0,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS lead_ingest_log_status_idx ON lead_ingest_log (status, created_at DESC);
