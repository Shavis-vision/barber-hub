ALTER TABLE public.services ADD COLUMN IF NOT EXISTS archived_at timestamptz;

DROP POLICY IF EXISTS svc_client_read_booked ON public.services;
CREATE POLICY svc_client_read_booked ON public.services
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.service_id = services.id AND a.booked_by = auth.uid()
  ));
