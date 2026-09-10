CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============ TABLES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_own" ON public.profiles FOR ALL TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE TABLE public.barbershops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  phone text,
  address text,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  slot_step_minutes int NOT NULL DEFAULT 15,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX barbershops_owner_idx ON public.barbershops(owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barbershops TO authenticated;
GRANT SELECT ON public.barbershops TO anon;
GRANT ALL ON public.barbershops TO service_role;
ALTER TABLE public.barbershops ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop_owner_all" ON public.barbershops FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "shop_public_read" ON public.barbershops FOR SELECT TO anon USING (true);

CREATE OR REPLACE FUNCTION public.owns_shop(p_shop uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.barbershops s WHERE s.id = p_shop AND s.owner_id = auth.uid());
$$;

CREATE TABLE public.barbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  photo_url text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX barbers_shop_idx ON public.barbers(barbershop_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barbers TO authenticated;
GRANT SELECT ON public.barbers TO anon;
GRANT ALL ON public.barbers TO service_role;
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "barbers_owner_all" ON public.barbers FOR ALL TO authenticated
  USING (public.owns_shop(barbershop_id)) WITH CHECK (public.owns_shop(barbershop_id));
CREATE POLICY "barbers_public_read" ON public.barbers FOR SELECT TO anon USING (active);

CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_cents int NOT NULL DEFAULT 0,
  duration_minutes int NOT NULL DEFAULT 30,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX services_shop_idx ON public.services(barbershop_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT SELECT ON public.services TO anon;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "services_owner_all" ON public.services FOR ALL TO authenticated
  USING (public.owns_shop(barbershop_id)) WITH CHECK (public.owns_shop(barbershop_id));
CREATE POLICY "services_public_read" ON public.services FOR SELECT TO anon USING (active);

CREATE TABLE public.barber_services (
  barber_id uuid NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  PRIMARY KEY (barber_id, service_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barber_services TO authenticated;
GRANT SELECT ON public.barber_services TO anon;
GRANT ALL ON public.barber_services TO service_role;
ALTER TABLE public.barber_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bsvc_owner_all" ON public.barber_services FOR ALL TO authenticated
  USING (public.owns_shop(barbershop_id)) WITH CHECK (public.owns_shop(barbershop_id));
CREATE POLICY "bsvc_public_read" ON public.barber_services FOR SELECT TO anon USING (true);

CREATE TABLE public.working_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  barber_id uuid REFERENCES public.barbers(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  opens time NOT NULL DEFAULT '09:00',
  closes time NOT NULL DEFAULT '19:00',
  is_open boolean NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX working_hours_unique ON public.working_hours(barbershop_id, COALESCE(barber_id, '00000000-0000-0000-0000-000000000000'::uuid), weekday);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.working_hours TO authenticated;
GRANT SELECT ON public.working_hours TO anon;
GRANT ALL ON public.working_hours TO service_role;
ALTER TABLE public.working_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wh_owner_all" ON public.working_hours FOR ALL TO authenticated
  USING (public.owns_shop(barbershop_id)) WITH CHECK (public.owns_shop(barbershop_id));
CREATE POLICY "wh_public_read" ON public.working_hours FOR SELECT TO anon USING (true);

CREATE TABLE public.blocked_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  barber_id uuid REFERENCES public.barbers(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX blocked_shop_idx ON public.blocked_times(barbershop_id, starts_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocked_times TO authenticated;
GRANT ALL ON public.blocked_times TO service_role;
ALTER TABLE public.blocked_times ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bt_owner_all" ON public.blocked_times FOR ALL TO authenticated
  USING (public.owns_shop(barbershop_id)) WITH CHECK (public.owns_shop(barbershop_id));

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX customers_shop_phone ON public.customers(barbershop_id, phone);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cust_owner_all" ON public.customers FOR ALL TO authenticated
  USING (public.owns_shop(barbershop_id)) WITH CHECK (public.owns_shop(barbershop_id));

CREATE TABLE public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  barber_id uuid NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('pending','confirmed','completed','cancelled','no_show')),
  price_cents int NOT NULL DEFAULT 0,
  notes text,
  source text NOT NULL DEFAULT 'public',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointments_time_valid CHECK (ends_at > starts_at),
  CONSTRAINT appointments_no_overlap EXCLUDE USING gist (
    barber_id WITH =, tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status <> 'cancelled')
);
CREATE INDEX appointments_shop_start_idx ON public.appointments(barbershop_id, starts_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointments TO authenticated;
GRANT ALL ON public.appointments TO service_role;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appt_owner_all" ON public.appointments FOR ALL TO authenticated
  USING (public.owns_shop(barbershop_id)) WITH CHECK (public.owns_shop(barbershop_id));

CREATE TABLE public.notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('appointment_confirmed','reminder_24h','reminder_same_day','appointment_cancelled','appointment_rescheduled')),
  channel text NOT NULL DEFAULT 'whatsapp',
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notif_pending_idx ON public.notification_events(status, scheduled_for);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_events TO authenticated;
GRANT ALL ON public.notification_events TO service_role;
ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_owner_all" ON public.notification_events FOR ALL TO authenticated
  USING (public.owns_shop(barbershop_id)) WITH CHECK (public.owns_shop(barbershop_id));

-- ============ BOOTSTRAP ============
CREATE OR REPLACE FUNCTION public.bootstrap_barbershop(p_name text, p_slug text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_shop uuid;
  v_slug text;
  v_i int := 0;
  v_barber uuid;
  d int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT id INTO v_shop FROM barbershops WHERE owner_id = v_uid ORDER BY created_at LIMIT 1;
  IF v_shop IS NOT NULL THEN RETURN v_shop; END IF;

  v_slug := regexp_replace(lower(coalesce(nullif(trim(p_slug), ''), p_name, 'barbearia')), '[^a-z0-9]+', '-', 'g');
  v_slug := trim(both '-' from v_slug);
  IF v_slug = '' THEN v_slug := 'barbearia'; END IF;
  WHILE EXISTS (SELECT 1 FROM barbershops WHERE slug = v_slug) LOOP
    v_i := v_i + 1;
    v_slug := trim(both '-' from regexp_replace(lower(coalesce(p_name,'barbearia')), '[^a-z0-9]+', '-', 'g')) || '-' || v_i::text;
  END LOOP;

  INSERT INTO barbershops (owner_id, name, slug)
  VALUES (v_uid, coalesce(nullif(trim(p_name), ''), 'Minha barbearia'), v_slug)
  RETURNING id INTO v_shop;

  INSERT INTO profiles (id) VALUES (v_uid) ON CONFLICT (id) DO NOTHING;

  FOR d IN 0..6 LOOP
    INSERT INTO working_hours (barbershop_id, weekday, opens, closes, is_open)
    VALUES (v_shop, d, '09:00', '19:00', d BETWEEN 1 AND 6);
  END LOOP;

  INSERT INTO services (barbershop_id, name, description, price_cents, duration_minutes)
  VALUES (v_shop, 'Corte', 'Corte na máquina e tesoura', 4000, 40),
         (v_shop, 'Barba', 'Barba com toalha quente', 3000, 30),
         (v_shop, 'Corte + Barba', 'Combo completo', 6000, 60);

  INSERT INTO barbers (barbershop_id, name) VALUES (v_shop, 'Barbeiro 1') RETURNING id INTO v_barber;
  INSERT INTO barber_services (barber_id, service_id, barbershop_id)
  SELECT v_barber, s.id, v_shop FROM services s WHERE s.barbershop_id = v_shop;

  RETURN v_shop;
END;
$$;
REVOKE ALL ON FUNCTION public.bootstrap_barbershop(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_barbershop(text, text) TO authenticated;

-- ============ AVAILABILITY ============
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
  WHERE barbershop_id = v_shop AND barber_id IS NULL AND weekday = v_dow;
  IF wh IS NULL OR NOT wh.is_open THEN RETURN; END IF;

  FOR r IN
    SELECT b.id FROM barbers b
    WHERE b.barbershop_id = v_shop AND b.active
      AND (p_barber IS NULL OR b.id = p_barber)
      AND EXISTS (SELECT 1 FROM barber_services bs WHERE bs.barber_id = b.id AND bs.service_id = p_service)
    ORDER BY b.name
  LOOP
    SELECT * INTO bh FROM working_hours
    WHERE barbershop_id = v_shop AND working_hours.barber_id = r.id AND weekday = v_dow;

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

-- ============ PUBLIC BOOKING ============
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
  ON CONFLICT (barbershop_id, phone) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_customer;

  INSERT INTO appointments (barbershop_id, barber_id, service_id, customer_id, starts_at, ends_at, price_cents, status, source)
  VALUES (v_shop, v_barber, p_service, v_customer, p_slot, p_slot + make_interval(mins => v_dur), v_price, 'confirmed', 'public')
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

-- ============ NOTIFICATION EVENTS FROM OWNER ACTIONS ============
CREATE OR REPLACE FUNCTION public.appointment_events() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO notification_events (barbershop_id, appointment_id, event_type, scheduled_for)
    VALUES (NEW.barbershop_id, NEW.id, 'appointment_confirmed', now())
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' THEN
    INSERT INTO notification_events (barbershop_id, appointment_id, event_type, scheduled_for)
    VALUES (NEW.barbershop_id, NEW.id, 'appointment_cancelled', now());
  ELSIF NEW.starts_at <> OLD.starts_at THEN
    INSERT INTO notification_events (barbershop_id, appointment_id, event_type, scheduled_for)
    VALUES (NEW.barbershop_id, NEW.id, 'appointment_rescheduled', now()),
           (NEW.barbershop_id, NEW.id, 'reminder_24h', NEW.starts_at - interval '24 hours');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER appointments_manual_events
AFTER INSERT ON public.appointments
FOR EACH ROW WHEN (NEW.source = 'manual')
EXECUTE FUNCTION public.appointment_events();

CREATE TRIGGER appointments_update_events
AFTER UPDATE ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.appointment_events();