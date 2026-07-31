create or replace function public.revoke_classroom_entitlement_sessions(
  target_entitlement_id uuid,
  requested_reason text,
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
  if target_entitlement_id is null
    or requested_reason is null
    or length(trim(requested_reason)) not between 1 and 120
    or requested_at is null then
    raise exception 'Invalid entitlement session revocation input.';
  end if;

  update public.classroom_sessions
  set status = 'revoked',
      revoked_at = requested_at,
      revocation_reason = lower(trim(requested_reason))
  where entitlement_id = target_entitlement_id
    and status = 'active';

  get diagnostics affected = row_count;
  return affected;
end;
$$;

revoke all on function public.revoke_classroom_entitlement_sessions(uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.revoke_classroom_entitlement_sessions(uuid, text, timestamptz)
  to service_role;

create or replace function public.revoke_classroom_access_invitation(
  target_invitation_id uuid,
  requested_reason text,
  requested_at timestamptz default now()
)
returns table(invitation_revoked boolean, sessions_revoked integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed integer;
  affected_sessions integer;
begin
  if target_invitation_id is null
    or requested_reason is null
    or length(trim(requested_reason)) not between 1 and 120
    or requested_at is null then
    raise exception 'Invalid invitation revocation input.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_invitation_id::text, 4)
  );

  update public.classroom_access_invitations
  set invalidated_at = coalesce(invalidated_at, requested_at),
      code_digest = null,
      revocation_reason = lower(trim(requested_reason))
  where id = target_invitation_id
    and invalidated_at is null;

  get diagnostics changed = row_count;

  update public.classroom_sessions
  set status = 'revoked',
      revoked_at = requested_at,
      revocation_reason = 'invitation_revoked'
  where invitation_id = target_invitation_id
    and status = 'active';

  get diagnostics affected_sessions = row_count;
  return query select changed > 0, affected_sessions;
end;
$$;

revoke all on function public.revoke_classroom_access_invitation(uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.revoke_classroom_access_invitation(uuid, text, timestamptz)
  to service_role;

create or replace function public.issue_classroom_access_invitation(
  target_entitlement_id uuid,
  requested_invitation_id uuid,
  requested_invitation_digest text,
  requested_expires_at timestamptz,
  requested_idempotency_key text,
  requested_request_hash text,
  requested_at timestamptz default now()
)
returns table(outcome text, invitation_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  entitlement public.classroom_entitlements%rowtype;
  cohort public.classroom_cohorts%rowtype;
  claim public.classroom_idempotency_records%rowtype;
  existing_invitation public.classroom_access_invitations%rowtype;
begin
  if target_entitlement_id is null
    or requested_invitation_id is null
    or requested_invitation_digest !~ '^[a-f0-9]{64}$'
    or requested_expires_at is null
    or requested_at is null
    or requested_expires_at <= requested_at
    or requested_idempotency_key is null
    or length(requested_idempotency_key) not between 8 and 200
    or requested_request_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid invitation issuance input.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_entitlement_id::text, 7)
  );

  select * into claim
  from public.classroom_idempotency_records
  where operation = 'access.invitation.issue'
    and idempotency_key = requested_idempotency_key
  for update;

  if found then
    if claim.request_hash <> requested_request_hash then
      return query select 'conflict'::text, null::uuid;
      return;
    end if;
    if claim.status = 'completed' then
      return query
      select
        coalesce(claim.response_payload ->> 'outcome', 'replay')::text,
        nullif(claim.response_payload ->> 'invitation_id', '')::uuid;
      return;
    end if;
    return query select 'conflict'::text, null::uuid;
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
    'access.invitation.issue',
    requested_idempotency_key,
    requested_request_hash,
    'started',
    requested_at,
    requested_at,
    requested_at + interval '24 hours'
  );

  select * into existing_invitation
  from public.classroom_access_invitations
  where id = requested_invitation_id;

  if found then
    if existing_invitation.entitlement_id <> target_entitlement_id
      or existing_invitation.invitation_digest <> requested_invitation_digest then
      update public.classroom_idempotency_records
      set status = 'completed',
          completed_at = requested_at,
          response_payload = jsonb_build_object('outcome', 'conflict')
      where operation = 'access.invitation.issue'
        and idempotency_key = requested_idempotency_key;
      return query select 'conflict'::text, null::uuid;
      return;
    end if;

    update public.classroom_idempotency_records
    set status = 'completed',
        completed_at = requested_at,
        response_payload = jsonb_build_object(
          'outcome', 'replay',
          'invitation_id', existing_invitation.id
        )
    where operation = 'access.invitation.issue'
      and idempotency_key = requested_idempotency_key;

    return query select 'replay'::text, existing_invitation.id;
    return;
  end if;

  select * into entitlement
  from public.classroom_entitlements
  where id = target_entitlement_id
    and status = 'active'
    and starts_at <= requested_at
    and (expires_at is null or expires_at > requested_at)
  for update;

  if not found then
    update public.classroom_idempotency_records
    set status = 'completed',
        completed_at = requested_at,
        response_payload = jsonb_build_object('outcome', 'denied')
    where operation = 'access.invitation.issue'
      and idempotency_key = requested_idempotency_key;
    return query select 'denied'::text, null::uuid;
    return;
  end if;

  select * into cohort
  from public.classroom_cohorts
  where id = entitlement.cohort_id;

  if not found
    or cohort.status <> 'active'
    or cohort.starts_at > requested_at
    or cohort.ends_at <= requested_at then
    update public.classroom_idempotency_records
    set status = 'completed',
        completed_at = requested_at,
        response_payload = jsonb_build_object('outcome', 'denied')
    where operation = 'access.invitation.issue'
      and idempotency_key = requested_idempotency_key;
    return query select 'denied'::text, null::uuid;
    return;
  end if;

  select * into existing_invitation
  from public.classroom_access_invitations
  where entitlement_id = target_entitlement_id
    and usage_policy = 'reusable'
    and invalidated_at is null
    and expired_at is null
    and expires_at > requested_at
  order by created_at desc, id
  limit 1
  for update;

  if found then
    update public.classroom_idempotency_records
    set status = 'completed',
        completed_at = requested_at,
        response_payload = jsonb_build_object(
          'outcome', 'active_exists',
          'invitation_id', existing_invitation.id
        )
    where operation = 'access.invitation.issue'
      and idempotency_key = requested_idempotency_key;
    return query select 'active_exists'::text, existing_invitation.id;
    return;
  end if;

  insert into public.classroom_access_invitations (
    id,
    invitation_digest,
    code_digest,
    user_id,
    entitlement_id,
    tier,
    issued_reason,
    expires_at,
    usage_policy,
    created_at,
    updated_at
  )
  values (
    requested_invitation_id,
    requested_invitation_digest,
    null,
    entitlement.user_id,
    entitlement.id,
    entitlement.tier,
    'support_reissue',
    least(requested_expires_at, cohort.ends_at, coalesce(entitlement.expires_at, requested_expires_at)),
    'reusable',
    requested_at,
    requested_at
  );

  update public.classroom_idempotency_records
  set status = 'completed',
      completed_at = requested_at,
      response_payload = jsonb_build_object(
        'outcome', 'created',
        'invitation_id', requested_invitation_id
      )
  where operation = 'access.invitation.issue'
    and idempotency_key = requested_idempotency_key;

  return query select 'created'::text, requested_invitation_id;
end;
$$;

revoke all on function public.issue_classroom_access_invitation(
  uuid, uuid, text, timestamptz, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.issue_classroom_access_invitation(
  uuid, uuid, text, timestamptz, text, text, timestamptz
) to service_role;

create or replace function public.regenerate_classroom_access_invitation(
  target_entitlement_id uuid,
  requested_invitation_id uuid,
  requested_invitation_digest text,
  requested_expires_at timestamptz,
  requested_reason text default 'regenerated',
  requested_at timestamptz default now()
)
returns table(outcome text, invitation_id uuid, prior_invitation_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  entitlement public.classroom_entitlements%rowtype;
  prior_invitation public.classroom_access_invitations%rowtype;
  existing_invitation public.classroom_access_invitations%rowtype;
begin
  if target_entitlement_id is null
    or requested_invitation_id is null
    or requested_invitation_digest !~ '^[a-f0-9]{64}$'
    or requested_expires_at is null
    or requested_at is null
    or requested_expires_at <= requested_at
    or requested_reason is null
    or length(trim(requested_reason)) not between 1 and 120 then
    raise exception 'Invalid invitation regeneration input.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(target_entitlement_id::text, 5)
  );

  select * into existing_invitation
  from public.classroom_access_invitations
  where id = requested_invitation_id;

  if found then
    if existing_invitation.invitation_digest <> requested_invitation_digest
      or existing_invitation.entitlement_id <> target_entitlement_id then
      return query select 'conflict'::text, null::uuid, null::uuid;
      return;
    end if;
    return query select 'replay'::text, existing_invitation.id, existing_invitation.regenerated_from_id;
    return;
  end if;

  select * into entitlement
  from public.classroom_entitlements
  where id = target_entitlement_id
    and status = 'active'
    and starts_at <= requested_at
    and (expires_at is null or expires_at > requested_at)
  for update;

  if not found then
    return query select 'denied'::text, null::uuid, null::uuid;
    return;
  end if;

  select * into prior_invitation
  from public.classroom_access_invitations
  where entitlement_id = target_entitlement_id
    and invalidated_at is null
    and expired_at is null
    and expires_at > requested_at
  order by created_at desc, id
  limit 1
  for update;

  insert into public.classroom_access_invitations (
    id,
    invitation_digest,
    code_digest,
    user_id,
    entitlement_id,
    tier,
    issued_reason,
    expires_at,
    usage_policy,
    regenerated_from_id,
    created_at,
    updated_at
  )
  values (
    requested_invitation_id,
    requested_invitation_digest,
    null,
    entitlement.user_id,
    entitlement.id,
    entitlement.tier,
    'support_reissue',
    requested_expires_at,
    'reusable',
    prior_invitation.id,
    requested_at,
    requested_at
  );

  update public.classroom_access_invitations
  set invalidated_at = requested_at,
      code_digest = null,
      revocation_reason = lower(trim(requested_reason)),
      replaced_by_id = requested_invitation_id
  where entitlement_id = target_entitlement_id
    and id <> requested_invitation_id
    and invalidated_at is null
    and expired_at is null
    and expires_at > requested_at;

  update public.classroom_sessions
  set status = 'revoked',
      revoked_at = requested_at,
      revocation_reason = 'invitation_regenerated'
  where entitlement_id = target_entitlement_id
    and status = 'active';

  return query select 'created'::text, requested_invitation_id, prior_invitation.id;
end;
$$;

revoke all on function public.regenerate_classroom_access_invitation(
  uuid, uuid, text, timestamptz, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.regenerate_classroom_access_invitation(
  uuid, uuid, text, timestamptz, text, timestamptz
) to service_role;
