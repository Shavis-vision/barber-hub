-- Guarda o nome informado em CADA agendamento (o cadastro do cliente continua ligado ao telefone).
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS customer_name text;

-- Agendamentos antigos recebem o nome que o cadastro do cliente tem hoje.
UPDATE public.appointments a
SET customer_name = c.name
FROM public.customers c
WHERE c.id = a.customer_id AND a.customer_name IS NULL;

CREATE OR REPLACE FUNCTION public.book_appointment(
  p_slug text, p_service uuid, p_barber uuid, p_slot timestamptz, p_name text, p_phone text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_shop uuid; v_dur int; v_price int; v_barber uuid; v_customer uuid; v_appt uuid; v_date date; v_tz text;
BEGIN
  IF coalesce(trim(p_name), '') = '' OR coalesce(trim(p_phone), '') = '' THEN
    RAISE EXCEPTION 'Informe nome e telefone.';
  END IF;

  SELECT id, timezone INTO v_shop, v_tz FROM barbershops WHERE slug = p_slug;
  IF v_shop IS NULL THEN RAISE EXCEPTION 'Barbearia não encontrada.'; END IF;

  SELECT duration_minutes, price_cents INTO v_dur, v_price FROM services
  WHERE id = p_service AND barbershop_id = v_shop AND active;
  IF v_dur IS NULL THEN RAISE EXCEPTION 'Serviço indisponível.'; END IF;

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

  INSERT INTO notification_events (barbershop_id, appointment_id, event_type, scheduled_for)
  VALUES (v_shop, v_appt, 'appointment_confirmed', now()),
         (v_shop, v_appt, 'reminder_24h', p_slot - interval '24 hours'),
         (v_shop, v_appt, 'reminder_same_day', date_trunc('day', p_slot AT TIME ZONE v_tz) AT TIME ZONE v_tz + interval '8 hours');

  RETURN jsonb_build_object('appointment_id', v_appt, 'barber_id', v_barber, 'starts_at', p_slot, 'ends_at', p_slot + make_interval(mins => v_dur));
EXCEPTION WHEN exclusion_violation THEN
  RAISE EXCEPTION 'Este horário acabou de ser reservado. Escolha outro.';
END;
$$;
REVOKE ALL ON FUNCTION public.book_appointment(text, uuid, uuid, timestamptz, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_appointment(text, uuid, uuid, timestamptz, text, text) TO anon, authenticated;
