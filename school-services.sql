-- Additional simulated self-service features. Back up database before applying.
-- Run AFTER school-upgrade.sql, using a PostgreSQL administrator.
CREATE TABLE IF NOT EXISTS school_service_requests (
 id BIGSERIAL PRIMARY KEY,
 student_user_id BIGINT NOT NULL REFERENCES users(id),
 kind TEXT NOT NULL CHECK(kind IN ('graduation','degree','enrollment_verification','transcript','banking_update')),
 details TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 admin_note TEXT NOT NULL DEFAULT '',
 reviewed_by BIGINT REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 reviewed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS school_attendance (
 id BIGSERIAL PRIMARY KEY,
 enrollment_id BIGINT NOT NULL REFERENCES acadia_enrollments(id) ON DELETE CASCADE,
 session_date DATE NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('present','absent','excused')),
 updated_by BIGINT NOT NULL REFERENCES users(id),
 UNIQUE(enrollment_id,session_date)
);
CREATE TABLE IF NOT EXISTS school_fee_definitions (
 id BIGSERIAL PRIMARY KEY,
 label TEXT NOT NULL UNIQUE,
 amount_cents BIGINT NOT NULL CHECK(amount_cents>=0),
 active BOOLEAN NOT NULL DEFAULT TRUE
);
INSERT INTO school_fee_definitions(label,amount_cents) VALUES
 ('Student services (demo)',20000),('Technology (demo)',15000),('Health services (demo)',10000)
ON CONFLICT(label) DO NOTHING;
GRANT SELECT,INSERT,UPDATE,DELETE ON school_service_requests,school_attendance,school_fee_definitions TO smartphone;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO smartphone;
