-- Remarcar: o horário atual do próprio cliente não deve bloquear a escolha de horários vizinhos
-- (ex.: corte de 30 min às 10:00 poder ir para 10:15). O horário continua só valendo se estiver livre de verdade.

-- Núcleo: igual a available_slots, com um agendamento opcional a ser ignorado. Não exposto pela API.
CREATE OR REPLACE FUNCTION public._available_slots(p_slug text, p_service uuid, p_barber uuid, p_date date, p_ignore uuid)
RETURNS TABLE (slot_at timestamptz, barber_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_shop uuid; v_tz text; v_step int; v_dur int; v_dow int;
  r record; wh record; bh record;
  v_open time; v_close time; t time; v_start timestamptz; v_end timestamptz;
BEGIN
  SELECT id, timezone, slot_step_minutes INTO v_shop, v_tz, v_step
  FROM barbershops WHERE slug = p_slug;
  IF v_shop IS NULL THEN RETURN; END IF;

  SELECT duration_minutes INTO v_dur FROM services
  WHERE id = p_service AND barbershop_id = v_shop AND active;
  IF v_dur IS NULL THEN RETURN; END IF;

  v_dow := EXTRACT(dow FROM p_date)::int;

  SELECT * INTO wh FROM working_hours
  WHERE working_hours.barbershop_id = v_shop AND working_hours.barber_id IS NULL AND working_hours.weekday = v_dow;
  IF wh IS NULL OR NOT wh.is_open THEN RETURN; END IF;

  FOR r IN
    SELECT b.id FROM barbers b
    WHERE b.barbershop_id = v_shop AND b.active
      AND (p_barber IS NULL OR b.id = p_barber)
      AND EXISTS (SELECT 1 FROM barber_services bs WHERE bs.barber_id = b.id AND bs.service_id = p_service)
    ORDER BY b.name
  LOOP
    SELECT * INTO bh FROM working_hours
    WHERE working_hours.barbershop_id = v_shop AND working_hours.barber_id = r.id AND working_hours.weekday = v_dow;

    IF bh IS NOT NULL AND NOT bh.is_open THEN CONTINUE; END IF;

    IF bh IS NULL THEN
      v_open := wh.opens; v_close := wh.closes;
    ELSE
      v_open := greatest(wh.opens, bh.opens); v_close := least(wh.closes, bh.closes);
    END IF;
    IF v_open >= v_close THEN CONTINUE; END IF;

    t := v_open;
    WHILE t + make_interval(mins => v_dur) <= v_close LOOP
      v_start := (p_date + t) AT TIME ZONE v_tz;
      v_end := v_start + make_interval(mins => v_dur);

      IF v_start > now() + interval '10 minutes'
        AND NOT EXISTS (
          SELECT 1 FROM appointments a
          WHERE a.barber_id = r.id AND a.status <> 'cancelled'
            AND (p_ignore IS NULL OR a.id <> p_ignore)
            AND tstzrange(a.starts_at, a.ends_at) && tstzrange(v_start, v_end))
        AND NOT EXISTS (
          SELECT 1 FROM blocked_times bt
          WHERE bt.barbershop_id = v_shop
            AND (bt.barber_id IS NULL OR bt.barber_id = r.id)
            AND tstzrange(bt.starts_at, bt.ends_at) && tstzrange(v_start, v_end))
      THEN
        slot_at := v_start; barber_id := r.id; RETURN NEXT;
      END IF;

      t := t + make_interval(mins => greatest(v_step, 5));
    END LOOP;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public._available_slots(text, uuid, uuid, date, uuid) FROM PUBLIC, anon, authenticated;

-- Função pública continua igual para o site (sem ignorar nada).
CREATE OR REPLACE FUNCTION public.available_slots(p_slug text, p_service uuid, p_barber uuid, p_date date)
RETURNS TABLE (slot_at timestamptz, barber_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.slot_at, s.barber_id FROM public._available_slots(p_slug, p_service, p_barber, p_date, NULL) s
$$;
REVOKE ALL ON FUNCTION public.available_slots(text, uuid, uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.available_slots(text, uuid, uuid, date) TO anon, authenticated;

-- Remarcar passa a considerar os horários livres sem contar o próprio agendamento.
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
  RETURN jsonb_build_object('ok', true, 'starts_at', p_slot);
EXCEPTION WHEN exclusion_violation THEN
  RAISE EXCEPTION 'Este horário acabou de ser reservado. Escolha outro.';
END $$;
REVOKE ALL ON FUNCTION public._appt_reschedule(uuid, timestamptz) FROM PUBLIC, anon, authenticated;

-- Horários livres para remarcar (mesmo serviço e barbeiro do agendamento, sem contar ele mesmo).
CREATE OR REPLACE FUNCTION public._appt_reschedule_slots(p_id uuid, p_date date)
RETURNS TABLE (slot_at timestamptz, barber_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; v_slug text;
BEGIN
  SELECT * INTO a FROM appointments WHERE id = p_id;
  IF NOT FOUND OR a.status NOT IN ('pending', 'confirmed') THEN RETURN; END IF;
  SELECT slug INTO v_slug FROM barbershops WHERE id = a.barbershop_id;
  RETURN QUERY
    SELECT s.slot_at, s.barber_id
    FROM public._available_slots(v_slug, a.service_id, a.barber_id, p_date, p_id) s
    WHERE s.slot_at <> a.starts_at;
END $$;
REVOKE ALL ON FUNCTION public._appt_reschedule_slots(uuid, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.managed_available_slots(p_token text, p_date date)
RETURNS TABLE (slot_at timestamptz, barber_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  SELECT appointment_id INTO v_id FROM appointment_manage_tokens WHERE token_hash = public._token_hash(coalesce(p_token, ''));
  IF v_id IS NULL THEN RETURN; END IF;
  RETURN QUERY SELECT s.slot_at, s.barber_id FROM public._appt_reschedule_slots(v_id, p_date) s;
END $$;

CREATE OR REPLACE FUNCTION public.my_available_slots(p_id uuid, p_date date)
RETURNS TABLE (slot_at timestamptz, barber_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT EXISTS (SELECT 1 FROM appointments WHERE id = p_id AND booked_by = auth.uid()) THEN RETURN; END IF;
  RETURN QUERY SELECT s.slot_at, s.barber_id FROM public._appt_reschedule_slots(p_id, p_date) s;
END $$;

REVOKE ALL ON FUNCTION public.managed_available_slots(text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.my_available_slots(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.managed_available_slots(text, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.my_available_slots(uuid, date) TO authenticated;
