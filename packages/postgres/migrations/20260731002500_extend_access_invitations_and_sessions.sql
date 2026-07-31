-- MadLogic Learning Core — reusable invitation and revocable session persistence.
-- This migration extends the existing classroom access model without replacing
-- entitlements, invitations, history, progress, idempotency, or outbox records.

alter table public.classroom_access_invitations
  add column if not exists usage_policy text not null default 'single_use',
  add column if not exists last_exchanged_at timestamptz,
  add column if not exists exchange_count integer not null default 0,
  add column if not exists expired_at timestamptz,
  add column if not exists revocation_reason text,
  add column if not exists regenerated_from_id uuid,
  add column if not exists replaced_by_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.classroom_access_invitations'::regclass
      and conname = 'classroom_access_invitations_usage_policy_check'
  ) then
    alter table public.classroom_access_invitations
      add constraint classroom_access_invitations_usage_policy_check
      check (usage_policy in ('reusable', 'single_use'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.classroom_access_invitations'::regclass
      and conname = 'classroom_access_invitations_exchange_count_check'
  ) then
    alter table public.classroom_access_invitations
      add constraint classroom_access_invitations_exchange_count_check
      check (exchange_count >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.classroom_access_invitations'::regclass
      and conname = 'classroom_access_invitations_regenerated_from_id_fkey'
  ) then
    alter table public.classroom_access_invitations
      add constraint classroom_access_invitations_regenerated_from_id_fkey
      foreign key (regenerated_from_id)
      references public.classroom_access_invitations(id)
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.classroom_access_invitations'::regclass
      and conname = 'classroom_access_invitations_replaced_by_id_fkey'
  ) then
    alter table public.classroom_access_invitations
      add constraint classroom_access_invitations_replaced_by_id_fkey
      foreign key (replaced_by_id)
      references public.classroom_access_invitations(id)
      on delete set null;
  end if;
end;
$$;

create index if not exists classroom_access_invitations_active_entitlement
  on public.classroom_access_invitations(entitlement_id, expires_at, created_at desc)
  where invalidated_at is null and expired_at is null;

create index if not exists classroom_access_invitations_expiration
  on public.classroom_access_invitations(expires_at)
  where invalidated_at is null and expired_at is null;

create index if not exists classroom_access_invitations_regenerated_from
  on public.classroom_access_invitations(regenerated_from_id)
  where regenerated_from_id is not null;

create table if not exists public.classroom_sessions (
  id uuid primary key default gen_random_uuid(),
  session_digest text not null unique
    check (session_digest ~ '^[a-f0-9]{64}$'),
  user_id uuid not null
    references auth.users(id)
    on delete cascade,
  entitlement_id uuid not null
    references public.classroom_entitlements(id)
    on delete cascade,
  invitation_id uuid not null
    references public.classroom_access_invitations(id)
    on delete cascade,
  status text not null default 'active'
    check (status in ('active', 'revoked', 'expired')),
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  rotation integer not null default 1
    check (rotation >= 1),
  version integer not null default 1
    check (version >= 1),
  revoked_at timestamptz,
  revocation_reason text,
  client_digest text
    check (client_digest is null or client_digest ~ '^[a-f0-9]{64}$'),
  refreshed_from_id uuid
    references public.classroom_sessions(id)
    on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > issued_at),
  check (last_seen_at >= issued_at),
  check (
    (status = 'revoked' and revoked_at is not null)
    or status <> 'revoked'
  )
);

comment on table public.classroom_sessions is
  'Server-side opaque learner sessions. Only digests are persisted; browser tokens remain outside the database.';

alter table public.classroom_sessions enable row level security;

create index if not exists classroom_sessions_active_entitlement
  on public.classroom_sessions(entitlement_id, expires_at, last_seen_at desc)
  where status = 'active';

create index if not exists classroom_sessions_active_invitation
  on public.classroom_sessions(invitation_id, expires_at)
  where status = 'active';

create index if not exists classroom_sessions_expiration
  on public.classroom_sessions(expires_at)
  where status = 'active';

create unique index if not exists classroom_sessions_one_active_per_invitation_client
  on public.classroom_sessions(invitation_id, coalesce(client_digest, ''))
  where status = 'active';

create index if not exists classroom_sessions_refreshed_from
  on public.classroom_sessions(refreshed_from_id)
  where refreshed_from_id is not null;

drop trigger if exists classroom_sessions_updated_at on public.classroom_sessions;
create trigger classroom_sessions_updated_at
before update on public.classroom_sessions
for each row execute function public.set_classroom_updated_at();

drop trigger if exists classroom_sessions_version on public.classroom_sessions;
create trigger classroom_sessions_version
before update on public.classroom_sessions
for each row execute function public.bump_classroom_version();

create or replace function public.record_classroom_invitation_access_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_name text;
  event_time timestamptz;
begin
  if tg_op = 'INSERT' then
    event_name := case
      when new.regenerated_from_id is not null then 'access.invitation_regenerated'
      else 'access.invitation_issued'
    end;
    event_time := new.created_at;
  elsif old.replaced_by_id is distinct from new.replaced_by_id
      and new.replaced_by_id is not null then
    event_name := 'access.invitation_regenerated';
    event_time := coalesce(new.invalidated_at, now());
  elsif old.invalidated_at is distinct from new.invalidated_at
      and new.invalidated_at is not null then
    event_name := 'access.invitation_revoked';
    event_time := new.invalidated_at;
  elsif old.expired_at is distinct from new.expired_at
      and new.expired_at is not null then
    event_name := 'access.invitation_expired';
    event_time := new.expired_at;
  else
    return new;
  end if;

  insert into public.classroom_outbox_events (
    aggregate_type,
    aggregate_id,
    event_type,
    payload,
    occurred_at
  )
  values (
    'access_invitation',
    new.id,
    event_name,
    jsonb_build_object(
      'enrollment_id', new.entitlement_id,
      'usage_policy', new.usage_policy,
      'exchange_count', new.exchange_count,
      'version', new.version,
      'regenerated_from_id', new.regenerated_from_id,
      'replaced_by_id', new.replaced_by_id,
      'revocation_reason', new.revocation_reason
    ),
    event_time
  );

  return new;
end;
$$;

revoke all on function public.record_classroom_invitation_access_event()
  from public, anon, authenticated;

drop trigger if exists classroom_access_invitations_access_event
  on public.classroom_access_invitations;
create trigger classroom_access_invitations_access_event
after insert or update of invalidated_at, expired_at, replaced_by_id
on public.classroom_access_invitations
for each row execute function public.record_classroom_invitation_access_event();

create or replace function public.record_classroom_session_access_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_name text;
  event_time timestamptz;
begin
  if tg_op = 'INSERT' then
    event_name := case
      when new.rotation > 1 then 'access.session_refreshed'
      else 'access.session_started'
    end;
    event_time := new.issued_at;
  elsif old.status is distinct from new.status and new.status = 'revoked' then
    event_name := 'access.session_revoked';
    event_time := coalesce(new.revoked_at, now());
  elsif old.status is distinct from new.status and new.status = 'expired' then
    event_name := 'access.session_expired';
    event_time := now();
  else
    return new;
  end if;

  insert into public.classroom_outbox_events (
    aggregate_type,
    aggregate_id,
    event_type,
    payload,
    occurred_at
  )
  values (
    'learner_session',
    new.id,
    event_name,
    jsonb_build_object(
      'enrollment_id', new.entitlement_id,
      'invitation_id', new.invitation_id,
      'rotation', new.rotation,
      'version', new.version,
      'status', new.status,
      'revocation_reason', new.revocation_reason
    ),
    event_time
  );

  return new;
end;
$$;

revoke all on function public.record_classroom_session_access_event()
  from public, anon, authenticated;

drop trigger if exists classroom_sessions_access_event on public.classroom_sessions;
create trigger classroom_sessions_access_event
after insert or update of status on public.classroom_sessions
for each row execute function public.record_classroom_session_access_event();
