-- Removes the records of the live verification of 15 October 2026 (link P-FU5FZR and the temporary test key).
-- Paste into Supabase -> SQL Editor -> Run. Confirm the "destructive operation" prompt.
select public.edt_withdraw_participant('P-FU5FZR') as events_deleted;
delete from public.edt_participants where participant_code = 'P-FU5FZR';
delete from public.edt_facilitator_keys where label like 'claude-live-test-2026-10-15%';
select (select count(*) from public.edt_participants) as participants,
       (select count(*) from public.edt_sessions) as sessions,
       (select count(*) from public.edt_events) as events,
       (select count(*) from public.edt_facilitator_keys where not revoked) as active_keys;
