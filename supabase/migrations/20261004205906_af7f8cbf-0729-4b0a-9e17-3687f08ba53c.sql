CREATE TABLE IF NOT EXISTS public.barber_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barbershop_id uuid NOT NULL REFERENCES public.barbershops(id) ON DELETE CASCADE,
  barber_id uuid NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE DEFAULT (replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  used_at timestamptz,
  used_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.barber_invites TO authenticated;
GRANT ALL ON public.barber_invites TO service_role;
ALTER TABLE public.barber_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inv_owner_all ON public.barber_invites;
CREATE POLICY inv_owner_all ON public.barber_invites FOR ALL TO authenticated
  USING (public.owns_shop(barbershop_id)) WITH CHECK (public.owns_shop(barbershop_id));

CREATE OR REPLACE FUNCTION public.get_barber_invite(p_code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE r record;
BEGIN
  SELECT i.used_at, i.expires_at, b.name AS barber_name, s.name AS shop_name
    INTO r FROM barber_invites i JOIN barbers b ON b.id = i.barber_id JOIN barbershops s ON s.id = i.barbershop_id
   WHERE i.code = p_code;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','invalid'); END IF;
  RETURN jsonb_build_object(
    'status', CASE WHEN r.used_at IS NOT NULL THEN 'used' WHEN r.expires_at < now() THEN 'expired' ELSE 'valid' END,
    'barber_name', r.barber_name, 'shop_name', r.shop_name);
END $$;

CREATE OR REPLACE FUNCTION public.accept_barber_invite(p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv record; b record; uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Entre na sua conta para aceitar o convite.'; END IF;
  SELECT * INTO inv FROM barber_invites WHERE code = p_code FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Convite inválido.'; END IF;
  IF inv.used_at IS NOT NULL THEN RAISE EXCEPTION 'Este convite já foi usado.'; END IF;
  IF inv.expires_at < now() THEN RAISE EXCEPTION 'Este convite expirou. Peça um novo ao dono da barbearia.'; END IF;
  SELECT * INTO b FROM barbers WHERE id = inv.barber_id FOR UPDATE;
  IF NOT FOUND OR NOT b.active THEN RAISE EXCEPTION 'Este barbeiro não está ativo.'; END IF;
  IF b.user_id IS NOT NULL THEN RAISE EXCEPTION 'Este barbeiro já tem uma conta vinculada.'; END IF;
  IF EXISTS (SELECT 1 FROM barbers WHERE user_id = uid) THEN RAISE EXCEPTION 'Sua conta já está vinculada a um barbeiro.'; END IF;
  IF EXISTS (SELECT 1 FROM barbershops WHERE owner_id = uid) OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = uid AND role = 'owner') THEN
    RAISE EXCEPTION 'Contas de dono de barbearia não podem ser vinculadas como barbeiro.'; END IF;
  UPDATE barbers SET user_id = uid WHERE id = b.id;
  INSERT INTO user_roles (user_id, role, barbershop_id)
    SELECT uid, 'barber', inv.barbershop_id
    WHERE NOT EXISTS (SELECT 1 FROM user_roles WHERE user_id = uid AND role = 'barber' AND barbershop_id = inv.barbershop_id);
  UPDATE barber_invites SET used_at = now(), used_by = uid WHERE id = inv.id;
  RETURN jsonb_build_object('ok', true, 'barber_id', b.id);
END $$;

REVOKE ALL ON FUNCTION public.get_barber_invite(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_barber_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_barber_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_barber_invite(text) TO authenticated;

-- Política de UPDATE do barbeiro (já existente com mesmo nome; recria igual de forma idempotente)
DROP POLICY IF EXISTS appt_barber_update_own ON public.appointments;
CREATE POLICY appt_barber_update_own ON public.appointments FOR UPDATE TO authenticated
  USING (barber_id = public.current_barber_id() AND public.is_shop_barber(barbershop_id))
  WITH CHECK (barber_id = public.current_barber_id() AND public.is_shop_barber(barbershop_id));