CREATE TABLE IF NOT EXISTS vp_users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vp_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES vp_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vp_login_attempts (
  email TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vp_state (
  workspace_id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  revision BIGINT NOT NULL DEFAULT 1,
  updated_by UUID REFERENCES vp_users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vp_state_history (
  id BIGSERIAL PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  revision BIGINT NOT NULL,
  updated_by UUID REFERENCES vp_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vp_state_history_workspace_revision
  ON vp_state_history(workspace_id, revision DESC);
