-- Fictional simulator degree requirements. No official university rules are implied.
CREATE TABLE IF NOT EXISTS public.acadia_degree_requirements (
 id BIGSERIAL PRIMARY KEY,
 program TEXT NOT NULL,
 course_code TEXT NOT NULL,
 required BOOLEAN NOT NULL DEFAULT TRUE,
 UNIQUE(program,course_code)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.acadia_degree_requirements TO smartphone;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO smartphone;
-- No invented required courses are seeded. Admin must configure the chosen degree.
