
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.are_friends(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_member(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_conv_admin(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_or_create_direct(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conv_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_direct(uuid) TO authenticated;
