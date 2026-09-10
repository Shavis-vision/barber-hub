REVOKE ALL ON FUNCTION public.appointment_events() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owns_shop(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owns_shop(uuid) TO authenticated;