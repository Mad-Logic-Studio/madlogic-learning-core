# PostgreSQL/Supabase Persistence

## Purpose

This persistence layer supports a real classroom deployment while keeping the reusable learning engine portable. It extends an existing installation rather than requiring a blank database.

## Layering

1. **Learning Core domain** — framework-neutral TypeScript contracts and transitions.
2. **PostgreSQL package** — migration files, repository contracts, row mappings, idempotency, and outbox boundaries.
3. **Private consumer** — project configuration, curriculum, branding, payment mappings, destinations, and secrets.

The first consumer drives practical requirements. Reuse is preserved by isolating consumer-specific configuration, not by building a multi-tenant SaaS product.

## Persistence mapping

| Learning concept | PostgreSQL representation |
| --- | --- |
| Course | `classroom_courses` |
| Course run or cohort | `classroom_cohorts` |
| Lesson | `classroom_lessons` |
| Enrollment | `classroom_entitlements` |
| Enrollment evidence | `classroom_entitlement_status_history` |
| Access link | `classroom_access_invitations` with digest-only material |
| Lesson progress | `classroom_lesson_progress` |
| Idempotency | `classroom_idempotency_records` |
| Domain event publication | `classroom_outbox_events` |

Existing classroom resources remain cohort-scoped and may point to a course-level lesson through `lesson_id`.

## Upgrade behavior

The initial migration is additive:

- creates one course definition for each unmapped existing cohort
- links every existing cohort to a course
- creates lessons from existing numbered classroom resources
- links numbered resources to their matching lesson
- adds optimistic-concurrency versions to entitlements and access invitations
- backfills pending and current enrollment-status evidence
- preserves all existing rows and identifiers

Applied migrations are append-only. Never edit or reorder a migration that has reached a consumer database.

## Concurrency and event delivery

Version triggers increment entitlement, invitation, and lesson-progress versions on update. Callers should include the expected version in their update predicate and treat a zero-row result as a concurrency conflict.

Enrollment-status and lesson-progress changes create outbox records in the same database transaction. A publisher may later claim and publish pending events without coupling domain writes to an external service.

## RLS model

Authenticated learners may:

- read published courses and available lessons covered by an effective entitlement
- read their own entitlement status history
- read, create, and advance their own lesson progress when the entitlement and lesson remain available

Internal invitation, purchase, reversal, recovery, rate-limit, idempotency, outbox, and entitlement-event data is unavailable to anonymous and authenticated client roles. Trusted server operations use a private server credential or direct PostgreSQL connection.

## Portability rules

A future consumer should be able to:

1. create a separate PostgreSQL or Supabase project
2. apply the ordered migrations
3. provide its own course, cohort, and resource data
4. map its private commerce and messaging integrations outside this package
5. validate RLS and generated database types before launch

No tenant system, generalized billing layer, white-label administration, or marketplace is implied.

## Deployment verification

After each DDL change:

- compare row counts and relationship completeness
- run transactional rollback-only behavior probes
- generate TypeScript database types
- review Supabase security and performance advisors
- verify that no public artifact contains project identifiers, secrets, or real learner data
