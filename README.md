# MadLogic Learning Core

MadLogic Learning Core is a **clean-room, lightweight TypeScript learning core informed by established open-source learning platforms and built from documented, permissively licensed dependencies and public standards**.

It is an early-stage, experimental, framework-neutral engine for custom learner experiences on Cloudflare-compatible runtimes with PostgreSQL/Supabase persistence. It does not require a full learning-management platform, password accounts, OTP flows, Supabase Auth, Redis, or a specific frontend framework.

> The API is under active development and subject to change. This repository is not production-ready.

## Purpose

The project establishes reusable contracts and persistence for learners, courses, scheduled course runs, durable enrollments, disposable access invitations, revocable browser sessions, lesson progress, authorization decisions, idempotency, and learning events. Private production consumers supply their own branding, curriculum, customer data, email/booking integrations, routes, and secrets.

## Architecture summary

- `packages/core`: provider-neutral domain vocabulary and one-click access services.
- `packages/postgres`: persistence contracts, Supabase/PostgreSQL mappings, and additive migrations.
- `packages/cloudflare`: runtime, crypto, cookie, redirect, request-context, and environment adapter contracts.
- `examples/astro-cloudflare-supabase`: safe compile-only composition scaffold.
- `docs`: architecture decisions, provenance, verification evidence, build journals, integration contracts, and security boundaries.

## Public/private implementation model

Security design, generic schemas, reusable adapters, tests, and documentation belong here. Production credentials, raw tokens, learner records, proprietary curriculum, private meeting or replay links, provider IDs, and operational environment values remain in private consumer repositories. See [the boundary policy](docs/architecture/public-private-boundary.md).

## Current capabilities

- strict framework-neutral TypeScript contracts
- reusable course and scheduled course-run/cohort separation
- durable enrollment evidence and append-only status history
- lesson release and forward-only progress
- digest-only reusable learner invitations
- scanner-prefetch-safe invitation validation
- opaque revocable server-side sessions
- secure cookie and clean redirect contracts
- entitlement-, run-, tier-, capability-, lesson-, and resource-aware authorization
- idempotent invitation issuance and exchange
- generic transactional outbox events
- Cloudflare-compatible runtime adapters
- additive PostgreSQL/Supabase migrations with RLS and least-privilege functions

## Non-goals for the current public core

- a hosted LMS user interface
- production route deployment
- password, OTP, or social-login identity flows
- Supabase Auth integration
- MailerLite, Trafft, or private classroom integrations
- package publication or compatibility guarantees
- multi-tenant LMS SaaS, billing, marketplace, grading, or institutional administration

## Workspace commands

CI installs a pinned TypeScript compiler before running these commands.

```sh
npm ci
npm install --no-save --ignore-scripts typescript@5.8.3
npm run verify
```

## Project guidance

- [Roadmap](ROADMAP.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)
- [Architecture decisions](docs/adr/)
- [Reuse and provenance matrix](docs/research/reuse-provenance-matrix.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)
- [WO-004 database evidence](docs/verification/wo-004-database-evidence.md)

## Provenance

MadLogic Learning Core is not a fork or derivative of a specific LMS. Moodle, Canvas LMS, Open edX, ClassroomIO, Wellms/EscolaLMS, LearnHouse, and CourseLit were architecture references only. No GPL or AGPL source code was copied, translated, adapted, linked, or vendored.

The repository has no third-party runtime npm dependency. TypeScript is the pinned compiler; Web Crypto provides cryptographic primitives; PostgreSQL/Supabase provides database, transaction, locking, trigger, and RLS capabilities. See the provenance matrix for exact snapshots and decisions.
