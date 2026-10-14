-- Hardening: the public API roles get no table access and cannot call the EDT functions.
-- (RLS without policies already denies rows; the functions also check current_user.)
revoke all on public.edt_participants, public.edt_sessions, public.edt_events, public.edt_facilitator_keys from anon, authenticated;
revoke execute on function public.edt_append_events(jsonb, jsonb, integer) from public, anon, authenticated;
revoke execute on function public.edt_create_facilitator_key(text) from public, anon, authenticated, service_role;
revoke execute on function public.edt_withdraw_participant(text) from public, anon, authenticated, service_role;
revoke execute on function public.edt_events_append_only() from public, anon, authenticated;
grant execute on function public.edt_append_events(jsonb, jsonb, integer) to service_role;
