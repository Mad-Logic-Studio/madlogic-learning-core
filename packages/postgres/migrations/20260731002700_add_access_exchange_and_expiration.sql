create or replace function public.exchange_classroom_access_invitation(
  requested_invitation_digest text,
  requested_session_id uuid,
  requested_session_digest text,
  requested_client_digest text,
  requested_idempotency_key text,
  requested_request_hash text,
  requested_at timestamptz,
  requested_expires_at timestamptz
)
returns table(outcome text, session_id uuid, entitlement_id uuid, invitation_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.classroom_access_invitations%rowtype;
  entitlement public.classroom_entitlements%rowtype;
  cohort public.classroom_cohorts%rowtype;
  claim public.classroom_idempotency_records%rowtype;
  effective_expires_at timestamptz;
  replay_session_id uuid;
begin
  if requested_invitation_digest !~ '^[a-f0-9]{64}$'
    or requested_session_id is null
    or requested_session_digest !~ '^[a-f0-9]{64}$'
    or (requested_client_digest is not null and requested_client_digest !~ '^[a-f0-9]{64}$')
    or requested_idempotency_key is null
    or length(requested_idempotency_key) not between 8 and 200
    or requested_request_hash !~ '^[a-f0-9]{64}$'
    or requested_at is null
    or requested_expires_at is null
    or requested_expires_at <= requested_at then
    raise exception 'Invalid invitation exchange input.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(requested_invitation_digest, 6)
  );

  select * into claim
  from public.classroom_idempotency_records
  where operation = 'access.invitation.exchange'
    and idempotency_key = requested_idempotency_key
  for update;

  if found then
    if claim.request_hash <> requested_request_hash then
      return query select 'conflict'::text, null::uuid, null::uuid, null::uuid;
      return;
    end if;
    if claim.status = 'completed' then
      replay_session_id := nullif(claim.response_payload ->> 'session_id', '')::uuid;
      return query
      select
        'replay'::text,
        replay_session_id,
        nullif(claim.response_payload ->> 'entitlement_id', '')::uuid,
        nullif(claim.response_payload ->> 'invitation_id', '')::uuid;
      return;
    end if;
    return query select 'conflict'::text, null::uuid, null::uuid, null::uuid;
    return;
  end if;

  insert into public.classroom_idempotency_records (
    operation,
    idempotency_key,
    request_hash,
    status,
    created_at,
    updated_at,
    expires_at
  )
  values (
    'access.invitation.exchange',
    requested_idempotency_key,
    requested_request_hash,
    'started',
    requested_at,
    requested_at,
    requested_at + interval '24 hours'
  );

  select * into invitation
  from public.classroom_access_invitations
  where invitation_digest = requested_invitation_digest
  for update;

  if not found
    or invitation.invalidated_at is not null
    or invitation.expired_at is not null
    or invitation.expires_at <= requested_at
    or (invitation.usage_policy = 'single_use' and invitation.consumed_at is not null) then
    insert into public.classroom_outbox_events (
      aggregate_type,
      aggregate_id,
      event_type,
      payload,
      occurred_at
    )
    values (
      'access_request',
      requested_session_id,
      'access.denied',
      jsonb_build_object('reason', 'invitation_unavailable'),
      requested_at
    );

    update public.classroom_idempotency_records
    set status = 'completed',
        completed_at = requested_at,
        response_payload = jsonb_build_object('outcome', 'denied')
    where operation = 'access.invitation.exchange'
      and idempotency_key = requested_idempotency_key;

    return query select 'denied'::text, null::uuid, null::uuid, null::uuid;
    return;
  end if;

  select * into entitlement
  from public.classroom_entitlements
  where id = invitation.entitlement_id
  for update;

  if not found
    or entitlement.status <> 'active'
    or entitlement.starts_at > requested_at
    or (entitlement.expires_at is not null and entitlement.expires_at <= requested_at) then
    insert into public.classroom_outbox_events (
      aggregate_type,
      aggregate_id,
      event_type,
      payload,
      occurred_at
    )
    values (
      'access_request',
      requested_session_id,
      'access.denied',
      jsonb_build_object('reason', 'enrollment_inactive'),
      requested_at
    );

    update public.classroom_idempotency_records
    set status = 'completed',
        completed_at = requested_at,
        response_payload = jsonb_build_object('outcome', 'denied')
    where operation = 'access.invitation.exchange'
      and idempotency_key = requested_idempotency_key;

    return query select 'denied'::text, null::uuid, null::uuid, invitation.id;
    return;
  end if;

  select * into cohort
  from public.classroom_cohorts
  where id = entitlement.cohort_id;

  if not found
    or cohort.status <> 'active'
    or cohort.starts_at > requested_at
    or cohort.ends_at <= requested_at then
    insert into public.classroom_outbox_events (
      aggregate_type,
      aggregate_id,
      event_type,
      payload,
      occurred_at
    )
    values (
      'access_request',
      requested_session_id,
      'access.denied',
      jsonb_build_object('reason', 'course_run_unavailable'),
      requested_at
    );

    update public.classroom_idempotency_records
    set status = 'completed',
        completed_at = requested_at,
        response_payload = jsonb_build_object('outcome', 'denied')
    where operation = 'access.invitation.exchange'
      and idempotency_key = requested_idempotency_key;

    return query select 'denied'::text, null::uuid, entitlement.id, invitation.id;
    return;
  end if;

  effective_expires_at := least(
    requested_expires_at,
    invitation.expires_at,
    cohort.ends_at,
    coalesce(entitlement.expires_at, requested_expires_at)
  );

  if effective_expires_at <= requested_at then
    insert into public.classroom_outbox_events (
      aggregate_type,
      aggregate_id,
      event_type,
      payload,
      occurred_at
    )
    values (
      'access_request',
      requested_session_id,
      'access.denied',
      jsonb_build_object('reason', 'session_expiration_unavailable'),
      requested_at
    );

    update public.classroom_idempotency_records
    set status = 'completed',
        completed_at = requested_at,
        response_payload = jsonb_build_object('outcome', 'denied')
    where operation = 'access.invitation.exchange'
      and idempotency_key = requested_idempotency_key;

    return query select 'denied'::text, null::uuid, entitlement.id, invitation.id;
    return;
  end if;

  update public.classroom_sessions
  set status = 'revoked',
      revoked_at = requested_at,
      revocation_reason = 'superseded_exchange'
  where invitation_id = invitation.id
    and status = 'active'
    and coalesce(client_digest, '') = coalesce(requested_client_digest, '');

  insert into public.classroom_sessions (
    id,
    session_digest,
    user_id,
    entitlement_id,
    invitation_id,
    status,
    issued_at,
    expires_at,
    last_seen_at,
    rotation,
    version,
    client_digest,
    created_at,
    updated_at
  )
  values (
    requested_session_id,
    requested_session_digest,
    entitlement.user_id,
    entitlement.id,
    invitation.id,
    'active',
    requested_at,
    effective_expires_at,
    requested_at,
    1,
    1,
    requested_client_digest,
    requested_at,
    requested_at
  );

  update public.classroom_access_invitations
  set last_exchanged_at = requested_at,
      exchange_count = exchange_count + 1
  where id = invitation.id;

  update public.classroom_idempotency_records
  set status = 'completed',
      completed_at = requested_at,
      response_payload = jsonb_build_object(
        'outcome', 'created',
        'session_id', requested_session_id,
        'entitlement_id', entitlement.id,
        'invitation_id', invitation.id
      )
  where operation = 'access.invitation.exchange'
    and idempotency_key = requested_idempotency_key;

  return query select 'created'::text, requested_session_id, entitlement.id, invitation.id;
end;
$$;

revoke all on function public.exchange_classroom_access_invitation(
  text, uuid, text, text, text, text, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.exchange_classroom_access_invitation(
  text, uuid, text, text, text, text, timestamptz, timestamptz
) to service_role;

create or replace function public.expire_classroom_access_invitations(
  requested_at timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  if requested_at is null then
    raise exception 'Expiration timestamp is required.';
  end if;

  update public.classroom_access_invitations
  set expired_at = requested_at,
      code_digest = null
  where invalidated_at is null
    and expired_at is null
    and expires_at <= requested_at;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.expire_classroom_access_invitations(timestamptz)
  from public, anon, authenticated;
grant execute on function public.expire_classroom_access_invitations(timestamptz)
  to service_role;

create or replace function public.expire_classroom_sessions(
  requested_at timestamptz default now()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
begin
  if requested_at is null then
    raise exception 'Expiration timestamp is required.';
  end if;

  update public.classroom_sessions
  set status = 'expired'
  where status = 'active'
    and expires_at <= requested_at;

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.expire_classroom_sessions(timestamptz)
  from public, anon, authenticated;
grant execute on function public.expire_classroom_sessions(timestamptz)
  to service_role;

create or replace function public.revoke_sessions_for_inactive_entitlement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status and new.status <> 'active' then
    perform public.revoke_classroom_entitlement_sessions(
      new.id,
      'entitlement_' || new.status,
      now()
    );
  end if;
  return new;
end;
$$;

revoke all on function public.revoke_sessions_for_inactive_entitlement()
  from public, anon, authenticated;

drop trigger if exists classroom_entitlements_revoke_sessions
  on public.classroom_entitlements;
create trigger classroom_entitlements_revoke_sessions
after update of status on public.classroom_entitlements
for each row execute function public.revoke_sessions_for_inactive_entitlement();

-- Session records and elevated access functions are never client-readable or client-callable.
drop policy if exists no_client_access_sessions on public.classroom_sessions;
create policy no_client_access_sessions
on public.classroom_sessions
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

revoke all on public.classroom_sessions from anon, authenticated;
grant all on public.classroom_sessions to service_role;

-- Existing invitation data remains server-only. Reassert least privilege after new columns/functions.
revoke all on public.classroom_access_invitations from anon, authenticated;
grant all on public.classroom_access_invitations to service_role;
