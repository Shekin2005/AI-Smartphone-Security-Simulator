-- Run as postgres against smartphone_security after the existing migrations.
-- Simulator only; no real bank or university accounts.
CREATE TABLE IF NOT EXISTS public.school_financial_adjustments (
 id BIGSERIAL PRIMARY KEY,
 student_user_id BIGINT NOT NULL REFERENCES public.users(id),
 admin_user_id BIGINT NOT NULL REFERENCES public.users(id),
 kind TEXT NOT NULL CHECK(kind IN ('charge','reverse_charge','scholarship')),
 description TEXT NOT NULL,
 amount_cents BIGINT NOT NULL CHECK(amount_cents>0),
 applied_cents BIGINT NOT NULL DEFAULT 0 CHECK(applied_cents>=0),
 bank_cents BIGINT NOT NULL DEFAULT 0 CHECK(bank_cents>=0),
 pending_cents BIGINT NOT NULL DEFAULT 0 CHECK(pending_cents>=0),
 bank_username TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_financial_adjustments TO smartphone;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO smartphone;

-- Ensure course editing columns exist on installations with older schemas.
ALTER TABLE public.acadia_catalog ADD COLUMN IF NOT EXISTS faculty TEXT;
ALTER TABLE public.acadia_catalog ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE public.acadia_catalog ADD COLUMN IF NOT EXISTS section TEXT DEFAULT 'FA01';
ALTER TABLE public.acadia_catalog ADD COLUMN IF NOT EXISTS capacity INTEGER DEFAULT 30;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.acadia_catalog TO smartphone;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.acadia_finance_entries TO smartphone;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.bank_accounts TO smartphone;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.student_profiles TO smartphone;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.acadia_admin_audit TO smartphone;
