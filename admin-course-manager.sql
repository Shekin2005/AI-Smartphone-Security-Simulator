-- Run in smartphone_security as postgres, after backup.
BEGIN;
ALTER TABLE public.acadia_catalog ADD COLUMN IF NOT EXISTS end_time TIME;
ALTER TABLE public.acadia_catalog ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.acadia_catalog ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.acadia_catalog ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 3;
ALTER TABLE public.acadia_catalog ADD COLUMN IF NOT EXISTS faculty TEXT NOT NULL DEFAULT 'Science';
ALTER TABLE public.acadia_catalog ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT 'Computer Science';
ALTER TABLE public.acadia_catalog ADD COLUMN IF NOT EXISTS section TEXT NOT NULL DEFAULT 'FA01';
ALTER TABLE public.acadia_catalog ADD COLUMN IF NOT EXISTS capacity INTEGER NOT NULL DEFAULT 30;
CREATE TABLE IF NOT EXISTS public.acadia_default_courses (
 id BIGSERIAL PRIMARY KEY,
 program TEXT NOT NULL,
 year_of_study INTEGER NOT NULL CHECK(year_of_study BETWEEN 1 AND 8),
 catalog_id BIGINT NOT NULL REFERENCES public.acadia_catalog(id),
 UNIQUE(program,year_of_study,catalog_id)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.acadia_default_courses TO smartphone;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO smartphone;
COMMIT;

SELECT
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'acadia_catalog',
    'acadia_enrollments',
    'acadia_default_courses',
    'school_attendance',
    'school_fee_definitions',
    'school_service_requests'
)
ORDER BY table_name;