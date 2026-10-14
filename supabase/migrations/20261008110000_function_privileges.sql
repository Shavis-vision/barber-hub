REVOKE EXECUTE ON FUNCTION public.bootstrap_barbershop(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_barber_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_shop_barber(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.grant_owner_role() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.bootstrap_barbershop(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_barber_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_shop_barber(uuid) TO authenticated;
