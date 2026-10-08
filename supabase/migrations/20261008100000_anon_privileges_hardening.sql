-- Endurecimento do acesso de visitantes (papel "anon") para um projeto Supabase NOVO.
-- Projetos novos liberam as tabelas para anon por padrão; a segurança por linha (RLS) ainda
-- protege, mas aqui o acesso de visitante fica limitado ao que a página pública realmente usa.

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- Leitura pública necessária para a página de agendamento.
GRANT SELECT ON public.services TO anon;
GRANT SELECT ON public.barber_services TO anon;
GRANT SELECT ON public.working_hours TO anon;

-- Só as colunas que a página pública usa (sem telefone do barbeiro, user_id nem owner_id).
GRANT SELECT (id, name, slug, address, phone, timezone, slot_step_minutes, created_at)
  ON public.barbershops TO anon;
GRANT SELECT (id, barbershop_id, name, photo_url, active)
  ON public.barbers TO anon;
