-- Idempotente: pode ser executada mesmo que a migração anterior já tenha rodado.

-- 1) Cliente logado (role "authenticated") precisa ler a vitrine pública da barbearia.
--    Sem estas políticas, quem está logado enxerga 0 linhas => "Barbearia não encontrada".
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS booked_by uuid DEFAULT auth.uid();
CREATE INDEX IF NOT EXISTS appointments_booked_by_idx ON public.appointments(booked_by) WHERE booked_by IS NOT NULL;

DROP POLICY IF EXISTS appt_client_read_own ON public.appointments;
CREATE POLICY appt_client_read_own ON public.appointments
  FOR SELECT TO authenticated USING (booked_by = auth.uid());

DROP POLICY IF EXISTS shop_public_read_auth ON public.barbershops;
CREATE POLICY shop_public_read_auth ON public.barbershops FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS barbers_public_read_auth ON public.barbers;
CREATE POLICY barbers_public_read_auth ON public.barbers FOR SELECT TO authenticated USING (active);
DROP POLICY IF EXISTS services_public_read_auth ON public.services;
CREATE POLICY services_public_read_auth ON public.services FOR SELECT TO authenticated USING (active);
DROP POLICY IF EXISTS bsvc_public_read_auth ON public.barber_services;
CREATE POLICY bsvc_public_read_auth ON public.barber_services FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS wh_public_read_auth ON public.working_hours;
CREATE POLICY wh_public_read_auth ON public.working_hours FOR SELECT TO authenticated USING (true);

-- 2) Busca de barbearias por nome (ignora maiúsculas e acentos), para o cliente
--    não precisar adivinhar o "slug".
CREATE OR REPLACE FUNCTION public.search_barbershops(p_query text)
RETURNS TABLE (name text, slug text, address text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH q AS (
    SELECT translate(lower(trim(coalesce(p_query, ''))),
             'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') AS t
  )
  SELECT s.name, s.slug, s.address
  FROM public.barbershops s, q
  WHERE length(q.t) >= 2
    AND (
      translate(lower(s.name), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc')
        LIKE '%' || replace(replace(q.t, '%', ''), '_', '') || '%'
      OR s.slug LIKE '%' || replace(replace(q.t, '%', ''), '_', '') || '%'
    )
  ORDER BY s.name
  LIMIT 20
$$;
REVOKE ALL ON FUNCTION public.search_barbershops(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_barbershops(text) TO anon, authenticated;
