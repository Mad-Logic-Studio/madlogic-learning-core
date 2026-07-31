# ADR-0011 — Consumer-First Portable Supabase Persistence

## Status

Accepted

## Context

The first real Learning Core deployment must extend an existing classroom database with live access and purchase workflows. The immediate goal is a useful classroom implementation, not a speculative multi-tenant LMS product. At the same time, the underlying learning model should remain easy to install in another PostgreSQL or Supabase project.

## Decision

Use additive PostgreSQL migrations that map the generic Learning Core model onto an existing classroom schema:

- `Course` → `classroom_courses`
- `CourseRun` → `classroom_cohorts`
- `Lesson` → `classroom_lessons`
- `Enrollment` → `classroom_entitlements` plus append-only status history
- `AccessLink` → digest-only `classroom_access_invitations`
- `LessonProgress` → `classroom_lesson_progress`
- idempotency → `classroom_idempotency_records`
- domain publication → `classroom_outbox_events`

Existing cohorts, entitlements, resources, invitations, purchase records, reversals, and events are preserved. Migrations backfill new relationships instead of replacing established tables.

The public package contains generic migrations, row mappings, synthetic tests, and architecture guidance. Deployment identifiers, credentials, real records, proprietary content, and private integration configuration remain outside the public repository.

## Consequences

- The first consumer receives a real persistence layer without a duplicate LMS database.
- Future projects can reuse the migrations and mapping patterns.
- Existing consumer-specific purchase and access tables remain supported.
- Portability requires a documented compatibility layer rather than pretending every database begins empty.
- Additional SaaS concerns such as tenants, billing, white labeling, and marketplace features remain out of scope.

## Alternatives considered

### Build a new isolated LMS schema

Rejected because it would duplicate working classroom data and workflows.

### Rewrite existing classroom tables into a greenfield generic design

Rejected because it creates migration risk and unnecessary scope.

### Build a fully generic multi-tenant LMS platform first

Rejected as overbuilding. Reusability is achieved through clean boundaries and migrations, not speculative product features.

## Security implications

- Learner-facing tables require RLS and explicit policies.
- Internal idempotency, outbox, invitation, purchase, recovery, and audit tables remain server-only.
- Access material is persisted as digests only.
- Security-definer trigger functions use an empty search path and are not directly executable by client roles.

## Public/private implications

The public repository records portable schema behavior and synthetic evidence. Private project references, secrets, customer data, curriculum, provider mappings, and operational destinations are prohibited.
