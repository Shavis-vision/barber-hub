-- Ajustes de desempenho sugeridos pelo Supabase. Não mudam o que cada pessoa pode ver ou fazer.

-- 1) Índices nas ligações entre tabelas (chaves estrangeiras sem índice).
CREATE INDEX IF NOT EXISTS appointment_changes_appointment_id_idx ON public.appointment_changes (appointment_id);
CREATE INDEX IF NOT EXISTS appointment_reschedules_appointment_id_idx ON public.appointment_reschedules (appointment_id);
CREATE INDEX IF NOT EXISTS appointments_customer_id_idx ON public.appointments (customer_id);
CREATE INDEX IF NOT EXISTS appointments_service_id_idx ON public.appointments (service_id);
CREATE INDEX IF NOT EXISTS barber_invites_barber_id_idx ON public.barber_invites (barber_id);
CREATE INDEX IF NOT EXISTS barber_invites_barbershop_id_idx ON public.barber_invites (barbershop_id);
CREATE INDEX IF NOT EXISTS barber_services_barbershop_id_idx ON public.barber_services (barbershop_id);
CREATE INDEX IF NOT EXISTS barber_services_service_id_idx ON public.barber_services (service_id);
CREATE INDEX IF NOT EXISTS blocked_times_barber_id_idx ON public.blocked_times (barber_id);
CREATE INDEX IF NOT EXISTS notification_events_appointment_id_idx ON public.notification_events (appointment_id);
CREATE INDEX IF NOT EXISTS notification_events_barbershop_id_idx ON public.notification_events (barbershop_id);
CREATE INDEX IF NOT EXISTS user_roles_barbershop_id_idx ON public.user_roles (barbershop_id);
CREATE INDEX IF NOT EXISTS working_hours_barber_id_idx ON public.working_hours (barber_id);

-- 2) Regras de acesso: calcula o usuário logado uma vez por consulta, não uma vez por linha.
--    ALTER POLICY troca só a condição; papéis e ações continuam iguais.
ALTER POLICY profiles_own ON public.profiles
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

ALTER POLICY shop_owner_all ON public.barbershops
  USING (owner_id = (SELECT auth.uid()))
  WITH CHECK (owner_id = (SELECT auth.uid()));

ALTER POLICY barbers_self_read ON public.barbers
  USING (user_id = (SELECT auth.uid()));

ALTER POLICY appt_client_read_own ON public.appointments
  USING (booked_by = (SELECT auth.uid()));

ALTER POLICY roles_read_own ON public.user_roles
  USING (user_id = (SELECT auth.uid()));

ALTER POLICY svc_client_read_booked ON public.services
  USING (EXISTS (
    SELECT 1 FROM public.appointments a
    WHERE a.service_id = services.id AND a.booked_by = (SELECT auth.uid())
  ));
