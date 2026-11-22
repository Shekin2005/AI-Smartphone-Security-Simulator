-- Run in smartphone_security as postgres. SIMULATOR ONLY.
CREATE TABLE IF NOT EXISTS public.sim_bank_link_codes (
 id BIGSERIAL PRIMARY KEY,
 bank_account_id BIGINT NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
 code_hash TEXT NOT NULL UNIQUE,
 expires_at TIMESTAMPTZ NOT NULL,
 used_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.sim_student_bank_links (
 student_user_id BIGINT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
 bank_account_id BIGINT NOT NULL REFERENCES public.bank_accounts(id),
 verified_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.sim_bank_link_codes,public.sim_student_bank_links TO smartphone;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO smartphone;
