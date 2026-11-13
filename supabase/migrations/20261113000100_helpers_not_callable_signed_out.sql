-- The role helpers are only needed by signed-in people. Signed-out callers get nothing from them anyway.
revoke execute on function public.my_role(), public.my_church(), public.is_team() from anon;
