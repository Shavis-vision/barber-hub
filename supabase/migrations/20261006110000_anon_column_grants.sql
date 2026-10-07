-- Visitantes (sem login) só leem as colunas que a página pública usa.
REVOKE SELECT ON public.barbershops FROM anon;
GRANT SELECT (id, name, slug, address, phone, timezone, slot_step_minutes, created_at)
  ON public.barbershops TO anon;

REVOKE SELECT ON public.barbers FROM anon;
GRANT SELECT (id, barbershop_id, name, photo_url, active)
  ON public.barbers TO anon;
