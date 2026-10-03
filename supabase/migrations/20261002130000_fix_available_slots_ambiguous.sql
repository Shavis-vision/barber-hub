-- Corrige: column reference "barber_id" is ambiguous (conflito com a coluna de saida barber_id).
CREATE OR REPLACE FUNCTION public.available_slots(p_slug text, p_service uuid, p_barber uuid, p_date date)
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
REVOKE ALL ON FUNCTION public.available_slots(text, uuid, uuid, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.available_slots(text, uuid, uuid, date) TO anon, authenticated;

