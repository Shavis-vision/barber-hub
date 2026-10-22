-- Cancelar / remarcar pelo cliente, com antecedência mínima de 2 horas.
-- Duas portas de entrada:
--   1) link secreto (convidado, sem conta): *_managed_appointment(token)
--   2) conta logada que fez o agendamento:  *_my_appointment(id)
-- A regra das 2 horas é aplicada aqui no banco, não no site.

-- Token do link secreto: só o hash fica guardado. Tabela sem acesso pela API.
CREATE TABLE IF NOT EXISTS public.appointment_manage_tokens (
  appointment_id uuid PRIMARY KEY REFERENCES public.appointments(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.appointment_manage_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.appointment_manage_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.appointment_manage_tokens TO service_role;

CREATE OR REPLACE FUNCTION public._token_hash(t text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT encode(sha256(convert_to(t, 'UTF8')), 'hex')
$$;
REVOKE ALL ON FUNCTION public._token_hash(text) FROM PUBLIC, anon, authenticated;

-- ===== núcleo (não exposto pela API) =====
CREATE OR REPLACE FUNCTION public._appt_cancel(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record;
BEGIN
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
  RETURN jsonb_build_object('ok', true);
END $$;

CREATE OR REPLACE FUNCTION public._appt_reschedule(p_id uuid, p_slot timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; v_slug text; v_tz text; v_len interval;
BEGIN
  SELECT * INTO a FROM appointments WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento não encontrado.'; END IF;
  IF a.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'Este agendamento não pode mais ser alterado.';
  END IF;
  IF a.starts_at - now() < interval '2 hours' THEN
    RAISE EXCEPTION 'Só é possível remarcar com pelo menos 2 horas de antecedência. Fale com a barbearia.';
  END IF;
  IF p_slot IS NULL THEN RAISE EXCEPTION 'Escolha o novo horário.'; END IF;

  SELECT slug, timezone INTO v_slug, v_tz FROM barbershops WHERE id = a.barbershop_id;
  -- Mesmo serviço e mesmo barbeiro; o horário precisa estar livre de verdade.
  IF NOT EXISTS (
    SELECT 1 FROM public.available_slots(v_slug, a.service_id, a.barber_id, (p_slot AT TIME ZONE v_tz)::date) s
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
  RETURN jsonb_build_object('ok', true, 'starts_at', p_slot);
EXCEPTION WHEN exclusion_violation THEN
  RAISE EXCEPTION 'Este horário acabou de ser reservado. Escolha outro.';
END $$;

REVOKE ALL ON FUNCTION public._appt_cancel(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._appt_reschedule(uuid, timestamptz) FROM PUBLIC, anon, authenticated;

-- ===== porta 1: link secreto =====
CREATE OR REPLACE FUNCTION public.get_managed_appointment(p_token text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  SELECT a.id, a.status, a.starts_at, a.ends_at, a.price_cents, a.service_id, a.barber_id,
         s.name AS shop_name, s.slug AS shop_slug, s.phone AS shop_phone, s.timezone AS shop_tz,
         sv.name AS service_name, b.name AS barber_name
    INTO r
    FROM appointment_manage_tokens t
    JOIN appointments a ON a.id = t.appointment_id
    JOIN barbershops s ON s.id = a.barbershop_id
    JOIN services sv ON sv.id = a.service_id
    JOIN barbers b ON b.id = a.barber_id
   WHERE t.token_hash = public._token_hash(coalesce(p_token, ''));
  IF NOT FOUND THEN RETURN jsonb_build_object('found', false); END IF;
  RETURN jsonb_build_object(
    'found', true, 'status', r.status, 'starts_at', r.starts_at, 'ends_at', r.ends_at,
    'price_cents', r.price_cents, 'service_id', r.service_id, 'barber_id', r.barber_id,
    'shop_name', r.shop_name, 'shop_slug', r.shop_slug, 'shop_phone', r.shop_phone, 'shop_tz', r.shop_tz,
    'service_name', r.service_name, 'barber_name', r.barber_name,
    'change_deadline', r.starts_at - interval '2 hours',
    'can_change', r.status IN ('pending', 'confirmed') AND r.starts_at - now() >= interval '2 hours');
END $$;

CREATE OR REPLACE FUNCTION public.cancel_managed_appointment(p_token text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  SELECT appointment_id INTO v_id FROM appointment_manage_tokens WHERE token_hash = public._token_hash(coalesce(p_token, ''));
  IF v_id IS NULL THEN RAISE EXCEPTION 'Link inválido.'; END IF;
  RETURN public._appt_cancel(v_id);
END $$;

CREATE OR REPLACE FUNCTION public.reschedule_managed_appointment(p_token text, p_slot timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  SELECT appointment_id INTO v_id FROM appointment_manage_tokens WHERE token_hash = public._token_hash(coalesce(p_token, ''));
  IF v_id IS NULL THEN RAISE EXCEPTION 'Link inválido.'; END IF;
  RETURN public._appt_reschedule(v_id, p_slot);
END $$;

-- ===== porta 2: conta logada que fez o agendamento =====
CREATE OR REPLACE FUNCTION public.cancel_my_appointment(p_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM appointments WHERE id = p_id AND booked_by = auth.uid()) THEN
    RAISE EXCEPTION 'Agendamento não encontrado.';
  END IF;
  RETURN public._appt_cancel(p_id);
END $$;

CREATE OR REPLACE FUNCTION public.reschedule_my_appointment(p_id uuid, p_slot timestamptz) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM appointments WHERE id = p_id AND booked_by = auth.uid()) THEN
    RAISE EXCEPTION 'Agendamento não encontrado.';
  END IF;
  RETURN public._appt_reschedule(p_id, p_slot);
END $$;

REVOKE ALL ON FUNCTION public.get_managed_appointment(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_managed_appointment(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reschedule_managed_appointment(text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_my_appointment(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reschedule_my_appointment(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_managed_appointment(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_managed_appointment(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_managed_appointment(text, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_my_appointment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reschedule_my_appointment(uuid, timestamptz) TO authenticated;

-- ===== book_appointment passa a devolver o link secreto (manage_token) =====
CREATE OR REPLACE FUNCTION public.book_appointment(
  p_slug text, p_service uuid, p_barber uuid, p_slot timestamptz, p_name text, p_phone text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_shop uuid; v_dur int; v_price int; v_barber uuid; v_customer uuid; v_appt uuid; v_date date; v_tz text;
  v_digits int; v_active int; v_token text;
  c_max_active constant int := 5;
BEGIN
  IF coalesce(trim(p_name), '') = '' OR coalesce(trim(p_phone), '') = '' THEN
    RAISE EXCEPTION 'Informe nome e telefone.';
  END IF;
  IF char_length(trim(p_name)) < 2 OR char_length(trim(p_name)) > 80 THEN
    RAISE EXCEPTION 'Informe um nome válido (2 a 80 caracteres).';
  END IF;
  v_digits := char_length(regexp_replace(p_phone, '\D', '', 'g'));
  IF v_digits < 10 OR v_digits > 13 OR char_length(p_phone) > 25 THEN
    RAISE EXCEPTION 'Informe um telefone válido com DDD.';
  END IF;

  SELECT id, timezone INTO v_shop, v_tz FROM barbershops WHERE slug = p_slug;
  IF v_shop IS NULL THEN RAISE EXCEPTION 'Barbearia não encontrada.'; END IF;

  SELECT duration_minutes, price_cents INTO v_dur, v_price FROM services
  WHERE id = p_service AND barbershop_id = v_shop AND active;
  IF v_dur IS NULL THEN RAISE EXCEPTION 'Serviço indisponível.'; END IF;

  SELECT count(*) INTO v_active
  FROM appointments a JOIN customers c ON c.id = a.customer_id
  WHERE c.barbershop_id = v_shop AND c.phone = trim(p_phone)
    AND a.status IN ('pending','confirmed') AND a.starts_at > now();
  IF v_active >= c_max_active THEN
    RAISE EXCEPTION 'Este telefone já tem % horários marcados. Aguarde um deles passar ou peça o cancelamento à barbearia.', c_max_active;
  END IF;

  v_date := (p_slot AT TIME ZONE v_tz)::date;

  SELECT s.barber_id INTO v_barber
  FROM public.available_slots(p_slug, p_service, p_barber, v_date) s
  WHERE s.slot_at = p_slot
  LIMIT 1;
  IF v_barber IS NULL THEN RAISE EXCEPTION 'Este horário não está mais disponível.'; END IF;

  INSERT INTO customers (barbershop_id, name, phone)
  VALUES (v_shop, trim(p_name), trim(p_phone))
  ON CONFLICT (barbershop_id, phone) DO UPDATE SET name = customers.name
  RETURNING id INTO v_customer;

  INSERT INTO appointments (barbershop_id, barber_id, service_id, customer_id, customer_name, starts_at, ends_at, price_cents, status, source)
  VALUES (v_shop, v_barber, p_service, v_customer, trim(p_name), p_slot, p_slot + make_interval(mins => v_dur), v_price, 'confirmed', 'public')
  RETURNING id INTO v_appt;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  INSERT INTO appointment_manage_tokens (appointment_id, token_hash) VALUES (v_appt, public._token_hash(v_token));

  INSERT INTO notification_events (barbershop_id, appointment_id, event_type, scheduled_for, payload)
  VALUES (v_shop, v_appt, 'appointment_confirmed', now(), jsonb_build_object('manage_path', '/agendamento/' || v_token)),
         (v_shop, v_appt, 'reminder_24h', p_slot - interval '24 hours', jsonb_build_object('manage_path', '/agendamento/' || v_token)),
         (v_shop, v_appt, 'reminder_same_day', date_trunc('day', p_slot AT TIME ZONE v_tz) AT TIME ZONE v_tz + interval '8 hours', '{}'::jsonb);

  RETURN jsonb_build_object('appointment_id', v_appt, 'barber_id', v_barber, 'starts_at', p_slot,
                            'ends_at', p_slot + make_interval(mins => v_dur), 'manage_token', v_token);
EXCEPTION WHEN exclusion_violation THEN
  RAISE EXCEPTION 'Este horário acabou de ser reservado. Escolha outro.';
END;
$$;
REVOKE ALL ON FUNCTION public.book_appointment(text, uuid, uuid, timestamptz, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_appointment(text, uuid, uuid, timestamptz, text, text) TO anon, authenticated;
