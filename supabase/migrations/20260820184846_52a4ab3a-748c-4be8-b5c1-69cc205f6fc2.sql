CREATE TABLE public.vaccinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cow_id uuid NOT NULL REFERENCES public.cows(id) ON DELETE CASCADE,
  vaccine_name text NOT NULL,
  vaccination_date date NOT NULL DEFAULT CURRENT_DATE,
  next_due_date date,
  is_completed boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vaccinations TO authenticated;
GRANT ALL ON public.vaccinations TO service_role;
ALTER TABLE public.vaccinations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vaccinations all" ON public.vaccinations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX vaccinations_cow_id_idx ON public.vaccinations (cow_id);
CREATE INDEX vaccinations_next_due_idx ON public.vaccinations (next_due_date);