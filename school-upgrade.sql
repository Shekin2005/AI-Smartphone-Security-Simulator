-- Run as PostgreSQL administrator against smartphone_security after backing up.
-- Preserves existing users, courses, tuition balances and payment records.
CREATE TABLE IF NOT EXISTS acadia_catalog (
 id BIGSERIAL PRIMARY KEY,
 code TEXT NOT NULL UNIQUE,
 title TEXT NOT NULL,
 term TEXT NOT NULL DEFAULT 'Fall 2026',
 instructor TEXT NOT NULL DEFAULT 'TBA',
 weekday TEXT NOT NULL DEFAULT 'Monday',
 start_time TIME NOT NULL DEFAULT '09:00',
 tuition_cents BIGINT NOT NULL DEFAULT 300000 CHECK (tuition_cents=300000),
 active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS acadia_enrollments (
 id BIGSERIAL PRIMARY KEY,
 student_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 catalog_id BIGINT NOT NULL REFERENCES acadia_catalog(id),
 grade TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(student_user_id,catalog_id)
);
CREATE TABLE IF NOT EXISTS acadia_profile_requests (
 id BIGSERIAL PRIMARY KEY,
 student_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 proposed_name TEXT NOT NULL,
 proposed_program TEXT NOT NULL,
 proposed_year INTEGER NOT NULL CHECK(proposed_year BETWEEN 1 AND 8),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 admin_note TEXT,
 reviewed_by BIGINT REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 reviewed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS acadia_finance_entries (
 id BIGSERIAL PRIMARY KEY,
 student_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 description TEXT NOT NULL,
 amount_cents BIGINT NOT NULL,
 source_key TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(student_user_id,source_key)
);
CREATE TABLE IF NOT EXISTS acadia_admin_audit (
 id BIGSERIAL PRIMARY KEY,
 admin_user_id BIGINT NOT NULL REFERENCES users(id),
 action TEXT NOT NULL,
 target_user_id BIGINT REFERENCES users(id),
 detail TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO acadia_catalog(code,title,term,weekday,start_time) VALUES
 ('COMP 3123','Computer Security','Fall 2026','Monday','09:00'),
 ('COMP 3553','Computer Graphics','Fall 2026','Tuesday','10:00'),
 ('COMP 2663','Software Engineering','Fall 2026','Wednesday','11:00'),
 ('COMP 3503','Data Analytics','Winter 2027','Thursday','09:00'),
 ('COMP 2103','Programming III','Winter 2027','Friday','10:00')
ON CONFLICT(code) DO NOTHING;
-- Existing legacy student_courses are left untouched; they are not retroactively charged.
-- The existing student_profiles.tuition_cents is treated as the opening outstanding balance.
-- New registrations add $3,000 each and new finance entries are recorded.
-- Change 'smartphone' below if DATABASE_URL uses another PostgreSQL role.
GRANT USAGE ON SCHEMA public TO smartphone;
GRANT SELECT,INSERT,UPDATE,DELETE ON acadia_catalog,acadia_enrollments,acadia_profile_requests,acadia_finance_entries,acadia_admin_audit TO smartphone;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO smartphone;
