CREATE TABLE IF NOT EXISTS grade_recovery (
 id BIGSERIAL PRIMARY KEY,
 enrollment_id BIGINT NOT NULL,
 administrator_id BIGINT NOT NULL,
 original_grade TEXT,
 published_grade TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 restored_at TIMESTAMPTZ
);
