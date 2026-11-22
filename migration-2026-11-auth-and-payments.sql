-- Run against a backed-up smartphone_security database. Non-destructive schema additions.
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT;
UPDATE users SET role = CASE WHEN app = 'bank' THEN 'bank_user' ELSE 'student' END WHERE role IS NULL;
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'student';
ALTER TABLE users ALTER COLUMN role SET NOT NULL;

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
