
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  app TEXT NOT NULL CHECK (app IN ('bank', 'acadia')),
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin', 'bank_user')),
  totp_secret TEXT,
  totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_totp_step BIGINT NOT NULL DEFAULT -1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (app, username)
);

CREATE TABLE IF NOT EXISTS bank_accounts (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('chequing', 'savings')),
  balance_cents BIGINT NOT NULL DEFAULT 0
    CHECK (balance_cents >= 0),
  UNIQUE (user_id, kind)
);

CREATE TABLE IF NOT EXISTS bank_transfers (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  from_kind TEXT NOT NULL,
  to_kind TEXT NOT NULL,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  request_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, request_id)
);

CREATE TABLE IF NOT EXISTS student_profiles (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  program TEXT NOT NULL,
  year_of_study INTEGER NOT NULL,
  tuition_cents BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS student_courses (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  term TEXT NOT NULL,
  grade TEXT
);

CREATE TABLE IF NOT EXISTS security_events (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  app TEXT,
  event_type TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================
-- AI SMARTPHONE SECURITY - ATTACK LAB
-- ============================================

-- Store the AI Defender ON/OFF setting.
CREATE TABLE IF NOT EXISTS lab_defender_settings (
    user_id BIGINT PRIMARY KEY
        REFERENCES users(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Historical incidents displayed by AI Defender.
CREATE TABLE IF NOT EXISTS lab_incidents (
    id BIGSERIAL PRIMARY KEY,
    actor_user_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,
    actor_username TEXT NOT NULL,
    target TEXT NOT NULL,
    scenario TEXT NOT NULL,
    mode TEXT NOT NULL,
    record_id TEXT,
    attempted_value TEXT,
    outcome TEXT NOT NULL,
    detail TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- Banking recipient, person transfer, and tuition payment records
CREATE TABLE IF NOT EXISTS bank_recipients (
  id BIGSERIAL PRIMARY KEY,
  owner_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (owner_user_id, recipient_user_id),
  CHECK (owner_user_id <> recipient_user_id)
);
CREATE TABLE IF NOT EXISTS bank_person_transfers (
  id BIGSERIAL PRIMARY KEY,
  sender_user_id BIGINT NOT NULL REFERENCES users(id),
  recipient_user_id BIGINT NOT NULL REFERENCES users(id),
  from_kind TEXT NOT NULL CHECK (from_kind IN ('chequing','savings')),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  request_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sender_user_id, request_id)
);
CREATE TABLE IF NOT EXISTS tuition_payments (
  id BIGSERIAL PRIMARY KEY,
  bank_user_id BIGINT NOT NULL REFERENCES users(id),
  student_user_id BIGINT NOT NULL REFERENCES users(id),
  payer_username TEXT NOT NULL,
  from_kind TEXT NOT NULL CHECK (from_kind IN ('chequing','savings')),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  request_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bank_user_id, request_id)
);

-- ---------------------------------------------------------------------------
-- The SQL injection exercise table
-- ---------------------------------------------------------------------------
-- /api/lab/exploit/sqli compares a parameterised query against a concatenated
-- one and reports whether the payload widened the match. That comparison only
-- means anything if the target has rows: with none, an injected OR matches
-- nothing and the exercise silently reports "injection had no effect".
--
-- This table previously existed only in the running database, seeded for
-- 'school' alone, so the 'bank' variant always did nothing and a fresh
-- deployment had no table at all.

CREATE TABLE IF NOT EXISTS lab_sqli_demo (
  id BIGSERIAL PRIMARY KEY,
  target TEXT NOT NULL CHECK (target IN ('bank', 'school')),
  label TEXT NOT NULL,
  secret TEXT NOT NULL
);

-- Fixed ids so re-running this file never duplicates the training rows.
INSERT INTO lab_sqli_demo (id, target, label, secret) VALUES
  (101, 'school', 'Training student A', 'LAB-GRADE-A'),
  (102, 'school', 'Training student B', 'LAB-GRADE-B'),
  (103, 'bank',   'Training account A', 'LAB-BANK-A'),
  (104, 'bank',   'Training account B', 'LAB-BANK-B')
ON CONFLICT (id) DO NOTHING;

-- Keep the sequence ahead of the fixed ids so real inserts do not collide.
SELECT setval(
  pg_get_serial_sequence('lab_sqli_demo', 'id'),
  GREATEST((SELECT MAX(id) FROM lab_sqli_demo), 1)
);
