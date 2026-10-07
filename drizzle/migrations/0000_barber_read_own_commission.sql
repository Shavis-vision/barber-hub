DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='barber_commissions' AND policyname='comm_barber_read_own') THEN
    CREATE POLICY comm_barber_read_own ON public.barber_commissions FOR SELECT TO authenticated USING (barber_id = public.current_barber_id());
  END IF;
END $$;
GRANT SELECT ON public.barber_commissions TO authenticated;