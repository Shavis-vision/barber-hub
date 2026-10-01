ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS booked_by uuid DEFAULT auth.uid();
CREATE INDEX IF NOT EXISTS appointments_booked_by_idx ON public.appointments(booked_by) WHERE booked_by IS NOT NULL;

CREATE POLICY appt_client_read_own ON public.appointments
  FOR SELECT TO authenticated USING (booked_by = auth.uid());

CREATE POLICY shop_public_read_auth ON public.barbershops FOR SELECT TO authenticated USING (true);
CREATE POLICY barbers_public_read_auth ON public.barbers FOR SELECT TO authenticated USING (active);
CREATE POLICY services_public_read_auth ON public.services FOR SELECT TO authenticated USING (active);
CREATE POLICY bsvc_public_read_auth ON public.barber_services FOR SELECT TO authenticated USING (true);
CREATE POLICY wh_public_read_auth ON public.working_hours FOR SELECT TO authenticated USING (true);