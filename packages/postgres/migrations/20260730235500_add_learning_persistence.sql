-- MadLogic Learning Core — additive PostgreSQL/Supabase persistence.
-- This migration upgrades an existing classroom installation without replacing
-- cohorts, entitlements, resources, access invitations, or purchase workflows.

create table if not exists public.classroom_courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null
    check (length(trim(title)) between 1 and 160),
  description text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.classroom_courses is
  'Reusable course definitions. Cohorts remain scheduled course runs.';

alter table public.classroom_courses enable row level security;

drop trigger if exists classroom_courses_updated_at on public.classroom_courses;
create trigger classroom_courses_updated_at
before update on public.classroom_courses
for each row execute function public.set_classroom_updated_at();

alter table public.classroom_cohorts
  add column if not exists course_id uuid;

insert into public.classroom_courses (
  slug,
  title,
  description,
  status,
  created_at,
  updated_at
)
select
  cohort.slug,
  cohort.title,
  '',
  case cohort.status
    when 'active' then 'published'
    when 'archived' then 'archived'
    else 'draft'
  end,
  cohort.created_at,
  cohort.updated_at
from public.classroom_cohorts cohort
where cohort.course_id is null
on conflict (slug) do nothing;

update public.classroom_cohorts cohort
set course_id = course.id
from public.classroom_courses course
where cohort.course_id is null
  and course.slug = cohort.slug;

do $$
begin
  if exists (
    select 1
    from public.classroom_cohorts
    where course_id is null
  ) then
    raise exception 'Every existing classroom cohort must map to a course before the migration can continue.';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.classroom_cohorts'::regclass
      and conname = 'classroom_cohorts_course_id_fkey'
  ) then
    alter table public.classroom_cohorts
      add constraint classroom_cohorts_course_id_fkey
      foreign key (course_id)
      references public.classroom_courses(id)
      on delete restrict;
  end if;
end;
$$;

alter table public.classroom_cohorts
  alter column course_id set not null;

create index if not exists classroom_cohorts_course_id
  on public.classroom_cohorts(course_id);

create table if not exists public.classroom_lessons (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null
    references public.classroom_courses(id)
    on delete cascade,
  slug text not null
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null
    check (length(trim(title)) between 1 and 160),
  description text not null default '',
  position integer not null
    check (position >= 1),
  status text not null default 'draft'
    check (status in ('draft', 'available', 'archived')),
  available_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (course_id, slug),
  unique (course_id, position)
);

comment on table public.classroom_lessons is
  'Course-level lesson definitions shared by one or more cohorts.';

alter table public.classroom_lessons enable row level security;

drop trigger if exists classroom_lessons_updated_at on public.classroom_lessons;
create trigger classroom_lessons_updated_at
before update on public.classroom_lessons
for each row execute function public.set_classroom_updated_at();

insert into public.classroom_lessons (
  course_id,
  slug,
  title,
  position,
  status,
  available_at
)
select
  cohort.course_id,
  'class-' || resource.class_number::text,
  'Class ' || resource.class_number::text,
  resource.class_number::integer,
  case
    when bool_and(resource.status = 'archived') then 'archived'
    when bool_or(resource.status = 'available') then 'available'
    else 'draft'
  end,
  min(resource.available_at)
from public.classroom_resources resource
join public.classroom_cohorts cohort
  on cohort.id = resource.cohort_id
where resource.class_number is not null
group by cohort.course_id, resource.class_number
on conflict (course_id, slug) do nothing;

alter table public.classroom_resources
  add column if not exists lesson_id uuid;

update public.classroom_resources resource
set lesson_id = lesson.id
from public.classroom_cohorts cohort
join public.classroom_lessons lesson
  on lesson.course_id = cohort.course_id
where resource.cohort_id = cohort.id
  and resource.lesson_id is null
  and resource.class_number is not null
  and lesson.position = resource.class_number::integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.classroom_resources'::regclass
      and conname = 'classroom_resources_lesson_id_fkey'
  ) then
    alter table public.classroom_resources
      add constraint classroom_resources_lesson_id_fkey
      foreign key (lesson_id)
      references public.classroom_lessons(id)
      on delete set null;
  end if;
end;
$$;

create index if not exists classroom_resources_lesson_id
  on public.classroom_resources(lesson_id)
  where lesson_id is not null;

alter table public.classroom_entitlements
  add column if not exists version integer not null default 1;

alter table public.classroom_access_invitations
  add column if not exists version integer not null default 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.classroom_entitlements'::regclass
      and conname = 'classroom_entitlements_version_positive'
  ) then
    alter table public.classroom_entitlements
      add constraint classroom_entitlements_version_positive
      check (version >= 1);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.classroom_access_invitations'::regclass
      and conname = 'classroom_access_invitations_version_positive'
  ) then
    alter table public.classroom_access_invitations
      add constraint classroom_access_invitations_version_positive
      check (version >= 1);
  end if;
end;
$$;

create or replace function public.bump_classroom_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version = old.version + 1;
  return new;
end;
$$;

revoke all on function public.bump_classroom_version() from public, anon, authenticated;

drop trigger if exists classroom_entitlements_version on public.classroom_entitlements;
create trigger classroom_entitlements_version
before update on public.classroom_entitlements
for each row execute function public.bump_classroom_version();

drop trigger if exists classroom_access_invitations_version on public.classroom_access_invitations;
create trigger classroom_access_invitations_version
before update on public.classroom_access_invitations
for each row execute function public.bump_classroom_version();

create table if not exists public.classroom_idempotency_records (
  operation text not null
    check (operation ~ '^[a-z0-9]+(?:[._:-][a-z0-9]+)*$'),
  idempotency_key text not null
    check (length(idempotency_key) between 8 and 200),
  request_hash text not null
    check (request_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'started'
    check (status in ('started', 'completed', 'failed')),
  response_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz,
  primary key (operation, idempotency_key),
  check (expires_at is null or expires_at > created_at),
  check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed')
  )
);

comment on table public.classroom_idempotency_records is
  'Server-only operation and request-hash claims for safe command replay.';

alter table public.classroom_idempotency_records enable row level security;

drop trigger if exists classroom_idempotency_records_updated_at on public.classroom_idempotency_records;
create trigger classroom_idempotency_records_updated_at
before update on public.classroom_idempotency_records
for each row execute function public.set_classroom_updated_at();

create index if not exists classroom_idempotency_records_expiration
  on public.classroom_idempotency_records(expires_at)
  where expires_at is not null;

create table if not exists public.classroom_outbox_events (
  id uuid primary key default gen_random_uuid(),
  aggregate_type text not null
    check (aggregate_type ~ '^[a-z][a-z0-9_]*$'),
  aggregate_id uuid not null,
  event_type text not null
    check (event_type ~ '^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)+$'),
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  available_at timestamptz not null default now(),
  published_at timestamptz,
  attempt_count integer not null default 0
    check (attempt_count >= 0),
  last_error text,
  created_at timestamptz not null default now()
);

comment on table public.classroom_outbox_events is
  'Server-only transactional outbox for durable learning-domain events.';

alter table public.classroom_outbox_events enable row level security;

create index if not exists classroom_outbox_events_pending
  on public.classroom_outbox_events(available_at, occurred_at)
  where published_at is null;

create table if not exists public.classroom_entitlement_status_history (
  id bigint generated always as identity primary key,
  entitlement_id uuid not null
    references public.classroom_entitlements(id)
    on delete cascade,
  status text not null
    check (status in ('pending', 'active', 'paused', 'completed', 'revoked', 'expired')),
  source_status text not null,
  reason text,
  changed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (entitlement_id, status, source_status, changed_at)
);

comment on table public.classroom_entitlement_status_history is
  'Append-only domain status evidence for classroom entitlements.';

alter table public.classroom_entitlement_status_history enable row level security;

create index if not exists classroom_entitlement_status_history_order
  on public.classroom_entitlement_status_history(entitlement_id, changed_at, id);

insert into public.classroom_entitlement_status_history (
  entitlement_id,
  status,
  source_status,
  reason,
  changed_at
)
select
  entitlement.id,
  'pending',
  'pending',
  'migration_backfill',
  entitlement.created_at
from public.classroom_entitlements entitlement
on conflict do nothing;

insert into public.classroom_entitlement_status_history (
  entitlement_id,
  status,
  source_status,
  reason,
  changed_at
)
select
  entitlement.id,
  case entitlement.status
    when 'active' then 'active'
    when 'expired' then 'expired'
    else 'revoked'
  end,
  entitlement.status,
  'migration_backfill',
  greatest(entitlement.created_at, entitlement.updated_at)
from public.classroom_entitlements entitlement
on conflict do nothing;

create table if not exists public.classroom_lesson_progress (
  id uuid primary key default gen_random_uuid(),
  entitlement_id uuid not null
    references public.classroom_entitlements(id)
    on delete cascade,
  user_id uuid not null
    references auth.users(id)
    on delete cascade,
  lesson_id uuid not null
    references public.classroom_lessons(id)
    on delete cascade,
  state text not null default 'not_started'
    check (state in ('not_started', 'in_progress', 'completed')),
  version integer not null default 1
    check (version >= 1),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entitlement_id, lesson_id),
  check (
    (state = 'not_started' and started_at is null and completed_at is null)
    or (state = 'in_progress' and started_at is not null and completed_at is null)
    or (
      state = 'completed'
      and started_at is not null
      and completed_at is not null
      and completed_at >= started_at
    )
  )
);

comment on table public.classroom_lesson_progress is
  'Learner progress scoped to a durable entitlement and course lesson.';

alter table public.classroom_lesson_progress enable row level security;

create index if not exists classroom_lesson_progress_user
  on public.classroom_lesson_progress(user_id, updated_at desc);

create index if not exists classroom_lesson_progress_lesson
  on public.classroom_lesson_progress(lesson_id, state);

create or replace function public.normalize_classroom_lesson_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.entitlement_id is distinct from old.entitlement_id
      or new.user_id is distinct from old.user_id
      or new.lesson_id is distinct from old.lesson_id then
      raise exception 'Lesson progress identity fields are immutable.';
    end if;

    if old.state = 'completed' and new.state <> 'completed' then
      raise exception 'Completed lesson progress is terminal.';
    end if;

    if old.state = 'in_progress' and new.state = 'not_started' then
      raise exception 'Lesson progress cannot move backward to not_started.';
    end if;

    new.version = old.version + 1;
    new.updated_at = now();
  else
    new.version = 1;
    new.created_at = coalesce(new.created_at, now());
    new.updated_at = coalesce(new.updated_at, new.created_at);
  end if;

  if new.state = 'not_started' then
    new.started_at = null;
    new.completed_at = null;
  elsif new.state = 'in_progress' then
    new.started_at = coalesce(new.started_at, case when tg_op = 'UPDATE' then old.started_at else null end, now());
    new.completed_at = null;
  elsif new.state = 'completed' then
    new.started_at = coalesce(new.started_at, case when tg_op = 'UPDATE' then old.started_at else null end, now());
    new.completed_at = coalesce(new.completed_at, now());
  end if;

  return new;
end;
$$;

revoke all on function public.normalize_classroom_lesson_progress() from public, anon, authenticated;

drop trigger if exists classroom_lesson_progress_normalize on public.classroom_lesson_progress;
create trigger classroom_lesson_progress_normalize
before insert or update on public.classroom_lesson_progress
for each row execute function public.normalize_classroom_lesson_progress();

create or replace function public.record_classroom_entitlement_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  domain_status text;
  event_name text;
  event_time timestamptz;
begin
  domain_status := case new.status
    when 'active' then 'active'
    when 'expired' then 'expired'
    else 'revoked'
  end;

  if tg_op = 'INSERT' then
    event_name := 'enrollment.created';
    event_time := new.created_at;

    insert into public.classroom_entitlement_status_history (
      entitlement_id,
      status,
      source_status,
      reason,
      changed_at
    )
    values (
      new.id,
      'pending',
      'pending',
      'entitlement_created',
      new.created_at
    )
    on conflict do nothing;
  elsif old.status is not distinct from new.status then
    return new;
  else
    event_name := 'enrollment.status_changed';
    event_time := now();
  end if;

  insert into public.classroom_entitlement_status_history (
    entitlement_id,
    status,
    source_status,
    reason,
    changed_at
  )
  values (
    new.id,
    domain_status,
    new.status,
    case when tg_op = 'INSERT' then 'entitlement_created' else 'status_changed' end,
    event_time
  )
  on conflict do nothing;

  insert into public.classroom_outbox_events (
    aggregate_type,
    aggregate_id,
    event_type,
    payload,
    occurred_at
  )
  values (
    'enrollment',
    new.id,
    event_name,
    jsonb_build_object(
      'learner_id', new.user_id,
      'course_run_id', new.cohort_id,
      'status', domain_status,
      'source_status', new.status,
      'tier', new.tier,
      'version', new.version
    ),
    event_time
  );

  return new;
end;
$$;

revoke all on function public.record_classroom_entitlement_status() from public, anon, authenticated;

drop trigger if exists classroom_entitlements_status_history on public.classroom_entitlements;
create trigger classroom_entitlements_status_history
after insert or update of status on public.classroom_entitlements
for each row execute function public.record_classroom_entitlement_status();

create or replace function public.record_classroom_lesson_progress_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_name text;
begin
  if tg_op = 'UPDATE' and old.state is not distinct from new.state then
    return new;
  end if;

  event_name := case new.state
    when 'in_progress' then 'lesson.started'
    when 'completed' then 'lesson.completed'
    else null
  end;

  if event_name is null then
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
    'lesson_progress',
    new.id,
    event_name,
    jsonb_build_object(
      'learner_id', new.user_id,
      'enrollment_id', new.entitlement_id,
      'lesson_id', new.lesson_id,
      'state', new.state,
      'version', new.version
    ),
    new.updated_at
  );

  return new;
end;
$$;

revoke all on function public.record_classroom_lesson_progress_event() from public, anon, authenticated;

drop trigger if exists classroom_lesson_progress_event on public.classroom_lesson_progress;
create trigger classroom_lesson_progress_event
after insert or update of state on public.classroom_lesson_progress
for each row execute function public.record_classroom_lesson_progress_event();

-- Learner-facing read policies.
drop policy if exists authenticated_read_entitled_courses on public.classroom_courses;
create policy authenticated_read_entitled_courses
on public.classroom_courses
for select
to authenticated
using (
  status = 'published'
  and exists (
    select 1
    from public.classroom_cohorts cohort
    join public.classroom_entitlements entitlement
      on entitlement.cohort_id = cohort.id
    where cohort.course_id = classroom_courses.id
      and entitlement.user_id = (select auth.uid())
      and entitlement.status = 'active'
      and entitlement.starts_at <= now()
      and (entitlement.expires_at is null or entitlement.expires_at > now())
  )
);

drop policy if exists authenticated_read_entitled_lessons on public.classroom_lessons;
create policy authenticated_read_entitled_lessons
on public.classroom_lessons
for select
to authenticated
using (
  status = 'available'
  and (available_at is null or available_at <= now())
  and exists (
    select 1
    from public.classroom_cohorts cohort
    join public.classroom_entitlements entitlement
      on entitlement.cohort_id = cohort.id
    where cohort.course_id = classroom_lessons.course_id
      and entitlement.user_id = (select auth.uid())
      and entitlement.status = 'active'
      and entitlement.starts_at <= now()
      and (entitlement.expires_at is null or entitlement.expires_at > now())
  )
);

drop policy if exists authenticated_read_own_entitlement_history on public.classroom_entitlement_status_history;
create policy authenticated_read_own_entitlement_history
on public.classroom_entitlement_status_history
for select
to authenticated
using (
  exists (
    select 1
    from public.classroom_entitlements entitlement
    where entitlement.id = classroom_entitlement_status_history.entitlement_id
      and entitlement.user_id = (select auth.uid())
  )
);

drop policy if exists authenticated_read_own_lesson_progress on public.classroom_lesson_progress;
create policy authenticated_read_own_lesson_progress
on public.classroom_lesson_progress
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists authenticated_insert_own_lesson_progress on public.classroom_lesson_progress;
create policy authenticated_insert_own_lesson_progress
on public.classroom_lesson_progress
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.classroom_entitlements entitlement
    join public.classroom_cohorts cohort
      on cohort.id = entitlement.cohort_id
    join public.classroom_lessons lesson
      on lesson.course_id = cohort.course_id
    where entitlement.id = classroom_lesson_progress.entitlement_id
      and entitlement.user_id = (select auth.uid())
      and entitlement.status = 'active'
      and entitlement.starts_at <= now()
      and (entitlement.expires_at is null or entitlement.expires_at > now())
      and lesson.id = classroom_lesson_progress.lesson_id
      and lesson.status = 'available'
      and (lesson.available_at is null or lesson.available_at <= now())
  )
);

drop policy if exists authenticated_update_own_lesson_progress on public.classroom_lesson_progress;
create policy authenticated_update_own_lesson_progress
on public.classroom_lesson_progress
for update
to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.classroom_entitlements entitlement
    join public.classroom_cohorts cohort
      on cohort.id = entitlement.cohort_id
    join public.classroom_lessons lesson
      on lesson.course_id = cohort.course_id
    where entitlement.id = classroom_lesson_progress.entitlement_id
      and entitlement.user_id = (select auth.uid())
      and entitlement.status = 'active'
      and entitlement.starts_at <= now()
      and (entitlement.expires_at is null or entitlement.expires_at > now())
      and lesson.id = classroom_lesson_progress.lesson_id
      and lesson.status = 'available'
      and (lesson.available_at is null or lesson.available_at <= now())
  )
);

-- Internal tables are intentionally unavailable through anon/authenticated APIs.
drop policy if exists no_client_access_idempotency on public.classroom_idempotency_records;
create policy no_client_access_idempotency
on public.classroom_idempotency_records
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists no_client_access_outbox on public.classroom_outbox_events;
create policy no_client_access_outbox
on public.classroom_outbox_events
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

revoke all on public.classroom_idempotency_records from anon, authenticated;
revoke all on public.classroom_outbox_events from anon, authenticated;

grant select on public.classroom_courses to authenticated;
grant select on public.classroom_lessons to authenticated;
grant select on public.classroom_entitlement_status_history to authenticated;
grant select, insert, update on public.classroom_lesson_progress to authenticated;

grant all on public.classroom_courses to service_role;
grant all on public.classroom_lessons to service_role;
grant all on public.classroom_entitlement_status_history to service_role;
grant all on public.classroom_lesson_progress to service_role;
grant all on public.classroom_idempotency_records to service_role;
grant all on public.classroom_outbox_events to service_role;
grant usage, select on sequence public.classroom_entitlement_status_history_id_seq to service_role;
grant select on sequence public.classroom_entitlement_status_history_id_seq to authenticated;
