-- One-time setup: paste this whole file into Supabase → SQL Editor → New query, then press Run.

-- Educational Digital Twin · pilot server schema (Prototype 1.7)
-- Participant records are append-only. Only the edt-engine Edge Function (service role) reads or
-- writes these tables; the public API roles have no access.

create table public.edt_participants (
  participant_id   text primary key,
  participant_code text not null unique,
  label            text not null default '',
  token_hash       text not null unique,
  disabled         boolean not null default false,
  created_at       timestamptz not null default now()
);

create table public.edt_sessions (
  session_id       text primary key,
  participant_id   text not null references public.edt_participants (participant_id) on delete restrict,
  participant_code text not null,
  session_kind     text not null check (session_kind in ('participant', 'demonstration')),
  stage            text not null,
  status           text not null check (status in ('in_progress', 'paused_for_review', 'completed')),
  event_count      integer not null default 0,
  last_sequence    integer not null default 0,
  training_level   text,
  started_at       timestamptz not null,
  updated_at       timestamptz not null
);
create index edt_sessions_participant_idx on public.edt_sessions (participant_id);

create table public.edt_events (
  session_id  text not null references public.edt_sessions (session_id) on delete restrict,
  sequence    integer not null check (sequence > 0),
  event_type  text not null,
  event       jsonb not null,
  recorded_at timestamptz not null default now(),
  primary key (session_id, sequence)
);

create table public.edt_facilitator_keys (
  key_id     uuid primary key default gen_random_uuid(),
  label      text not null default '',
  key_hash   text not null unique,
  revoked    boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.edt_participants     enable row level security;
alter table public.edt_sessions         enable row level security;
alter table public.edt_events           enable row level security;
alter table public.edt_facilitator_keys enable row level security;

-- Append-only event log. Deletion is possible only inside edt_withdraw_participant.
create or replace function public.edt_events_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and current_setting('edt.allow_withdrawal', true) = 'on' then
    return old;
  end if;
  raise exception 'edt_events is append-only';
end;
$$;

create trigger edt_events_no_update_delete
before update or delete on public.edt_events
for each row execute function public.edt_events_append_only();

-- Atomic append: creates the session on the first batch, checks the expected last sequence under a
-- row lock, inserts the events and updates the session summary in one transaction.
create or replace function public.edt_append_events(p_session jsonb, p_events jsonb, p_expected integer)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_id  text := p_session ->> 'session_id';
  v_cur integer;
  v_n   integer := jsonb_array_length(p_events);
begin
  if current_user not in ('service_role', 'postgres') then
    raise exception 'not permitted';
  end if;
  if p_expected = 0 then
    insert into public.edt_sessions (session_id, participant_id, participant_code, session_kind, stage, status,
                                     event_count, last_sequence, training_level, started_at, updated_at)
    values (v_id, p_session ->> 'participant_id', p_session ->> 'participant_code', p_session ->> 'session_kind',
            'START', 'in_progress', 0, 0, null, (p_session ->> 'started_at')::timestamptz, (p_session ->> 'started_at')::timestamptz)
    on conflict (session_id) do nothing;
    if not found then
      return 'conflict';
    end if;
  end if;

  select last_sequence into v_cur from public.edt_sessions where session_id = v_id for update;
  if v_cur is null or v_cur <> p_expected then
    return 'conflict';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_events) with ordinality as e(ev, i)
    where (e.ev ->> 'sequence')::integer <> p_expected + e.i::integer or e.ev ->> 'session_id' <> v_id
  ) then
    raise exception 'events are not contiguous for session %', v_id;
  end if;

  insert into public.edt_events (session_id, sequence, event_type, event)
  select v_id, (e.ev ->> 'sequence')::integer, e.ev ->> 'event_type', e.ev
  from jsonb_array_elements(p_events) as e(ev);

  update public.edt_sessions set
    stage          = p_session ->> 'stage',
    status         = p_session ->> 'status',
    event_count    = event_count + v_n,
    last_sequence  = p_expected + v_n,
    training_level = coalesce(p_session ->> 'training_level', training_level),
    updated_at     = (p_session ->> 'updated_at')::timestamptz
  where session_id = v_id;

  return 'ok';
end;
$$;

-- Facilitator key: run in the SQL editor; the key is returned once and only its hash is stored.
create or replace function public.edt_create_facilitator_key(p_label text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_key text := 'fk_' || encode(extensions.gen_random_bytes(24), 'hex');
begin
  if current_user <> 'postgres' then
    raise exception 'run this from the SQL editor';
  end if;
  insert into public.edt_facilitator_keys (label, key_hash)
  values (coalesce(p_label, ''), encode(extensions.digest(v_key, 'sha256'), 'hex'));
  return v_key;
end;
$$;

-- Data withdrawal on request (consent): removes all records of one participant code, disables the link.
create or replace function public.edt_withdraw_participant(p_code text)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_n integer;
begin
  if current_user <> 'postgres' then
    raise exception 'run this from the SQL editor';
  end if;
  perform set_config('edt.allow_withdrawal', 'on', true);
  delete from public.edt_events where session_id in (select session_id from public.edt_sessions where participant_code = p_code);
  get diagnostics v_n = row_count;
  delete from public.edt_sessions where participant_code = p_code;
  update public.edt_participants set disabled = true, label = '[withdrawn]' where participant_code = p_code;
  perform set_config('edt.allow_withdrawal', 'off', true);
  return v_n;
end;
$$;
-- Hardening: the public API roles get no table access and cannot call the EDT functions.
-- (RLS without policies already denies rows; the functions also check current_user.)
revoke all on public.edt_participants, public.edt_sessions, public.edt_events, public.edt_facilitator_keys from anon, authenticated;
revoke execute on function public.edt_append_events(jsonb, jsonb, integer) from public, anon, authenticated;
revoke execute on function public.edt_create_facilitator_key(text) from public, anon, authenticated, service_role;
revoke execute on function public.edt_withdraw_participant(text) from public, anon, authenticated, service_role;
revoke execute on function public.edt_events_append_only() from public, anon, authenticated;
grant execute on function public.edt_append_events(jsonb, jsonb, integer) to service_role;

-- Finally: create your facilitator key. The key is shown once in the result below; store it in a password manager.
select public.edt_create_facilitator_key('Juan P. Emmerich') as facilitator_key;
