-- Global tables (domains, domain_ontology) are read-only shared data.
-- Allow all authenticated users to read them.

ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read domains"
  ON public.domains
  FOR SELECT
  USING ((select auth.uid()) IS NOT NULL);

ALTER TABLE public.domain_ontology ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read domain_ontology"
  ON public.domain_ontology
  FOR SELECT
  USING ((select auth.uid()) IS NOT NULL);
