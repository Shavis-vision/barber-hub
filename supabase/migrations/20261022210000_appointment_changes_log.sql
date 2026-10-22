-- Histórico de cancelamentos e remarcações para o dono: o que mudou, quando e QUEM fez.
CREATE TABLE IF NOT EXISTS public.appointment_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  barber_id uuid,
  kind text NOT NULL CHECK (kind IN ('cancelled', 'rescheduled')),
  actor text NOT NULL CHECK (actor IN ('client', 'owner', 'barber', 'system')),
  from_starts_at timestamptz NOT NULL,
  to_starts_at timestamptz,
  customer_name text,
  service_name text,
  price_cents int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS appointment_changes_shop_created_idx
  ON public.appointment_changes(barbershop_id, created_at DESC);

ALTER TABLE public.appointment_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY changes_owner_read ON public.appointment_changes
  FOR SELECT TO authenticated USING (public.owns_shop(barbershop_id));
REVOKE ALL ON public.appointment_changes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.appointment_changes TO authenticated;
GRANT ALL ON public.appointment_changes TO service_role;

-- Quem fez: as funções do cliente marcam 'client' dentro da própria transação; senão deduz pelo login.
CREATE OR REPLACE FUNCTION public.log_appointment_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_kind text; v_to timestamptz; v_actor text;
BEGIN
  IF OLD.status IN ('pending', 'confirmed') AND NEW.status = 'cancelled' THEN
    v_kind := 'cancelled'; v_to := NULL;
  ELSIF OLD.status IN ('pending', 'confirmed') AND NEW.status IN ('pending', 'confirmed')
        AND NEW.starts_at IS DISTINCT FROM OLD.starts_at THEN
    v_kind := 'rescheduled'; v_to := NEW.starts_at;
  ELSE
    RETURN NEW;
  END IF;

  v_actor := nullif(current_setting('app.actor', true), '');
  IF v_actor IS NULL OR v_actor NOT IN ('client', 'owner', 'barber', 'system') THEN
    IF auth.uid() IS NULL THEN v_actor := 'system';
    ELSIF public.owns_shop(NEW.barbershop_id) THEN v_actor := 'owner';
    ELSIF public.is_shop_barber(NEW.barbershop_id) THEN v_actor := 'barber';
    ELSE v_actor := 'system';
    END IF;
  END IF;

  INSERT INTO public.appointment_changes
    (appointment_id, barbershop_id, barber_id, kind, actor, from_starts_at, to_starts_at, customer_name, service_name, price_cents)
  VALUES (
    NEW.id, NEW.barbershop_id, OLD.barber_id, v_kind, v_actor, OLD.starts_at, v_to,
    COALESCE(NEW.customer_name, (SELECT c.name FROM public.customers c WHERE c.id = NEW.customer_id)),
    (SELECT s.name FROM public.services s WHERE s.id = NEW.service_id),
    NEW.price_cents
  );
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.log_appointment_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER appointments_log_change
AFTER UPDATE ON public.appointments
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.starts_at IS DISTINCT FROM NEW.starts_at)
EXECUTE FUNCTION public.log_appointment_change();

-- As funções do cliente passam a se identificar como 'client'.
CREATE OR REPLACE FUNCTION public._appt_cancel(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record;
BEGIN
  PERFORM set_config('app.actor', 'client', true);
  SELECT * INTO a FROM appointments WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento não encontrado.'; END IF;
  IF a.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'Este agendamento não pode mais ser alterado.';
  END IF;
  IF a.starts_at - now() < interval '2 hours' THEN
    RAISE EXCEPTION 'Só é possível cancelar com pelo menos 2 horas de antecedência. Fale com a barbearia.';
  END IF;
  UPDATE notification_events SET status = 'skipped'
   WHERE appointment_id = p_id AND status = 'pending' AND event_type IN ('reminder_24h', 'reminder_same_day');
  UPDATE appointments SET status = 'cancelled' WHERE id = p_id;
  PERFORM set_config('app.actor', '', true);
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public._appt_cancel(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._appt_reschedule(p_id uuid, p_slot timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; v_slug text; v_tz text; v_len interval;
BEGIN
  PERFORM set_config('app.actor', 'client', true);
  SELECT * INTO a FROM appointments WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento não encontrado.'; END IF;
  IF a.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'Este agendamento não pode mais ser alterado.';
  END IF;
  IF a.starts_at - now() < interval '2 hours' THEN
    RAISE EXCEPTION 'Só é possível remarcar com pelo menos 2 horas de antecedência. Fale com a barbearia.';
  END IF;
  IF p_slot IS NULL THEN RAISE EXCEPTION 'Escolha o novo horário.'; END IF;
  IF p_slot = a.starts_at THEN RAISE EXCEPTION 'Este já é o horário do seu agendamento. Escolha outro.'; END IF;

  SELECT slug, timezone INTO v_slug, v_tz FROM barbershops WHERE id = a.barbershop_id;
  IF NOT EXISTS (
    SELECT 1 FROM public._available_slots(v_slug, a.service_id, a.barber_id, (p_slot AT TIME ZONE v_tz)::date, p_id) s
    WHERE s.slot_at = p_slot
  ) THEN
    RAISE EXCEPTION 'Este horário não está disponível. Escolha outro.';
  END IF;

  v_len := a.ends_at - a.starts_at;
  UPDATE notification_events SET status = 'skipped'
   WHERE appointment_id = p_id AND status = 'pending' AND event_type IN ('reminder_24h', 'reminder_same_day');
  UPDATE appointments SET starts_at = p_slot, ends_at = p_slot + v_len WHERE id = p_id;
  INSERT INTO notification_events (barbershop_id, appointment_id, event_type, scheduled_for)
  VALUES (a.barbershop_id, p_id, 'reminder_same_day',
          date_trunc('day', p_slot AT TIME ZONE v_tz) AT TIME ZONE v_tz + interval '8 hours');
  PERFORM set_config('app.actor', '', true);
  RETURN jsonb_build_object('ok', true, 'starts_at', p_slot);
EXCEPTION WHEN exclusion_violation THEN
  RAISE EXCEPTION 'Este horário acabou de ser reservado. Escolha outro.';
END $$;
REVOKE ALL ON FUNCTION public._appt_reschedule(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
