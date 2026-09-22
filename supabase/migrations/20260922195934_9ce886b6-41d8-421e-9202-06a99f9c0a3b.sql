-- 1. Papéis
CREATE TYPE public.app_role AS ENUM ('owner', 'barber', 'client');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  barbershop_id uuid REFERENCES public.barbershops(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, barbershop_id)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY roles_read_own ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY roles_owner_manage ON public.user_roles
  FOR ALL TO authenticated
  USING (barbershop_id IS NOT NULL AND public.owns_shop(barbershop_id))
  WITH CHECK (barbershop_id IS NOT NULL AND public.owns_shop(barbershop_id));

-- 2. Backfill dos donos atuais + trigger para novas barbearias
INSERT INTO public.user_roles (user_id, role, barbershop_id)
SELECT owner_id, 'owner'::public.app_role, id FROM public.barbershops
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.grant_owner_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role, barbershop_id)
  VALUES (NEW.owner_id, 'owner', NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER barbershops_grant_owner_role
AFTER INSERT ON public.barbershops
FOR EACH ROW EXECUTE FUNCTION public.grant_owner_role();

-- 3. Vínculo barbeiro -> conta autenticada
ALTER TABLE public.barbers ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS barbers_user_id_key ON public.barbers(user_id) WHERE user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.current_barber_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.barbers WHERE user_id = auth.uid() LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_shop_barber(_shop uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.barbers
    WHERE user_id = auth.uid() AND barbershop_id = _shop AND active
  )
$$;

REVOKE EXECUTE ON FUNCTION public.current_barber_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_shop_barber(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;

-- 4. Políticas de leitura para o barbeiro (somente SELECT)
CREATE POLICY shop_barber_read ON public.barbershops
  FOR SELECT TO authenticated USING (public.is_shop_barber(id));

CREATE POLICY barbers_self_read ON public.barbers
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY svc_barber_read ON public.services
  FOR SELECT TO authenticated USING (public.is_shop_barber(barbershop_id));

CREATE POLICY bsvc_barber_read ON public.barber_services
  FOR SELECT TO authenticated USING (barber_id = public.current_barber_id());

CREATE POLICY wh_barber_read ON public.working_hours
  FOR SELECT TO authenticated USING (public.is_shop_barber(barbershop_id));

CREATE POLICY bt_barber_read ON public.blocked_times
  FOR SELECT TO authenticated
  USING (public.is_shop_barber(barbershop_id)
         AND (barber_id IS NULL OR barber_id = public.current_barber_id()));

CREATE POLICY appt_barber_read ON public.appointments
  FOR SELECT TO authenticated USING (barber_id = public.current_barber_id());

CREATE POLICY cust_barber_read ON public.customers
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.customer_id = customers.id
        AND a.barber_id = public.current_barber_id()
    )
  );