# MadLogic Learning Core

MadLogic Learning Core is an **early-stage, experimental, framework-neutral TypeScript learning engine** for headless learner experiences. It is designed for custom frontends, Cloudflare-compatible runtimes, and PostgreSQL/Supabase persistence without requiring a full learning-management platform.

> The API is under active development and subject to change. This repository is not production-ready.

## Purpose

The project establishes reusable contracts for learners, courses, scheduled course runs, durable enrollments, disposable access links, lesson progress, and learning events. Private production consumers supply their own branding, curriculum, customer data, integrations, and secrets.

## Architecture summary

- `packages/core`: provider-neutral domain vocabulary and service contracts.
- `packages/postgres`: generic persistence interfaces and migration conventions.
- `packages/cloudflare`: runtime, request-context, and cookie/session abstraction contracts.
- `examples/astro-cloudflare-supabase`: safe compile-only composition scaffold.
- `docs`: architecture decisions, provenance, build journals, integration contracts, and security boundaries.

## Public/private implementation model

Security design, generic schemas, reusable adapters, tests, and documentation belong here. Production credentials, raw tokens, learner records, proprietary curriculum, private meeting or replay links, and provider-specific operational identifiers remain in private consumer repositories. See [the boundary policy](docs/architecture/public-private-boundary.md).

## Design goals

- strict, framework-neutral TypeScript contracts
- durable enrollment evidence separate from temporary access links
- support for live, evergreen, and cohort delivery
- adapters for Cloudflare and PostgreSQL/Supabase
- one-click access architecture without implementing token issuance in v0.1
- explicit provenance and clean-room research practices

## Non-goals for v0.1

- production authentication or token issuance
- a hosted LMS user interface
- production database provisioning
- MailerLite, Trafft, or private classroom integrations
- package publication, deployment, or compatibility guarantees

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
- [Third-party research and notices](THIRD_PARTY_NOTICES.md)

## Upstream credit

Architecture and user-experience research includes ClassroomIO, Wellms/EscolaLMS, LearnHouse, CourseLit, and Better Auth. No upstream source code was copied in Work Order 001. Research does not imply upstream endorsement.
