# Reuse and Provenance Matrix

## Scope and classification

This audit covers WO-001 through WO-004. It records what was installed, what was implemented from public standards, what was studied only as an architectural reference, and what was authored specifically for MadLogic Learning Core.

1. **Direct dependency** — an installed package, runtime primitive, database engine, or CI tool used by the repository.
2. **Adapted permissive code** — permissively licensed source copied or translated and then modified.
3. **Adapted public specification** — behavior implemented from a published standard or platform contract without copying an implementation.
4. **Architecture reference only** — concepts or behavior studied; no source copied or translated.
5. **Original MadLogic implementation** — code and schema authored for this repository from project requirements, public specifications, and the existing classroom contract.

## Executive conclusion

MadLogic Learning Core is **not a fork, derivative, or adaptation of one LMS repository**. Moodle, Canvas LMS, Open edX, ClassroomIO, Wellms/EscolaLMS, LearnHouse, and CourseLit were reviewed only to understand established learning-platform boundaries and vocabulary. No source from those projects was copied, translated, linked, or vendored.

The repository has **no third-party runtime npm dependency**. The lockfile contains only MadLogic workspace packages. TypeScript 5.8.3 is installed by CI as the pinned compiler. Runtime cryptography is delegated to Web Crypto; persistence, locking, transactions, triggers, and RLS are delegated to PostgreSQL/Supabase.

No element is classified as **Adapted permissive code** in WO-001 through WO-004.

## Reviewed upstream snapshots

| Upstream or standard | Exact snapshot reviewed | License/status | Treatment |
|---|---|---|---|
| `moodle/moodle` | commit `70771c10954e532fce2c25874dffc57259550e25` | GPL-3.0 | Architecture reference only |
| `instructure/canvas-lms` | commit `1c9f0bb8013ed69c4f2efe11fd483025469b7e6c` | AGPL-3.0 | Architecture reference only |
| `openedx/openedx-platform` | commit `8915b9161af68e4584224b86023babc8ecfd3e9e` | AGPL-3.0 | Architecture reference only |
| ClassroomIO | WO-001 recorded snapshot | AGPL-family restrictions recorded in WO-001 research | Architecture reference only |
| Wellms / EscolaLMS | WO-001 recorded snapshot | AGPL-family restrictions recorded in WO-001 research | Architecture reference only |
| LearnHouse | WO-001 recorded snapshot | License must be reverified before any reuse | Architecture reference only |
| CourseLit | WO-001 recorded snapshot | License must be reverified before any reuse | Architecture reference only |
| `colinhacks/zod` | v4.4.3; release commit `1fb56a5` | MIT | Evaluated, not installed |
| `uuidjs/uuid` | v13.0.2; release commit `bd34976` | MIT | Evaluated, not installed |
| `supabase/supabase-js` | v2.105.3; release commit `84a729b` | MIT | Evaluated for later private integration, not installed |
| `honojs/hono` | v4.12.23 release line | MIT | Evaluated for a later private route adapter, not installed |
| `adonisjs/session` | release line inspected 2026-04-09 | MIT | Session architecture reference only |
| TypeScript | 5.8.3 | Apache-2.0 | Direct build dependency |
| Node.js | 22 in CI | Node.js licenses | Direct build/test runtime and standard library |
| Web Cryptography API | W3C Recommendation 2017; Level 2 draft 2025 | Public web specification | Secure random and SHA-256 contract |
| RFC 3986 | URI Generic Syntax | IETF standard | URL-safe token and redirect constraints |
| RFC 6265 and RFC6265bis draft 22 | HTTP cookies | IETF standard/draft | Cookie semantics and attributes |
| RFC 9110 | HTTP Semantics | IETF standard | 303 redirect and cache semantics |
| RFC 9562 | UUIDs | IETF standard | Identifier semantics |
| PostgreSQL | 17.x documentation; deployed engine 17 | PostgreSQL License | Direct database engine and behavior |
| Supabase | hosted PostgreSQL, migration, type generation, and advisor tooling | Platform service | Direct deployment/verification platform; Supabase Auth not used |
| Cloudflare Workers Web APIs | current Workers Web Standards contracts | Platform documentation | Runtime adapter target |
| xAPI | 1.0.3 repository snapshot; current 2.0 status noted | Apache-2.0 specification | Event-vocabulary reference only |
| Transactional outbox pattern | established architecture pattern | Public architecture pattern | Architecture reference only |
| Ports-and-adapters / hexagonal architecture | established architecture pattern | Public architecture pattern | Architecture reference only |

## Subsystem matrix

| Subsystem | Classification | Upstream or specification reviewed | Files/concepts influenced | Source copied? | Direct reuse evaluation and decision | Maintenance/security implications | MadLogic difference |
|---|---|---|---|---|---|---|---|
| Learner and course domain model | 4 + 5 | Moodle, Canvas, Open edX | `packages/core/src/index.ts` learner/course vocabulary | No | Full LMS domain packages were rejected because they include grading, institutional roles, authoring, and account systems outside scope | Small model is independently auditable; interoperability mappings can be added later | Minimal headless learning nouns only |
| Course-run and cohort model | 4 + 5 | Open edX course runs; Canvas courses/sections; Moodle course instances | `CourseRun`, `classroom_courses`, `classroom_cohorts` | No | No small permissive package replaces the project-specific distinction | Prevents delivery dates and cohorts from contaminating reusable course definitions | Reusable course separated from scheduled delivery run |
| Enrollment model | 4 + 5 | Common LMS enrollment concepts; existing classroom entitlements | enrollment contracts, status history, mappings | No | Existing classroom entitlement schema was authoritative; external LMS enrollment models were incompatible | Versioning and append-only history protect durable evidence | Enrollment remains after invitation/session revocation |
| Lesson and progress model | 3 + 4 + 5 | LMS modules/progress; xAPI completion concepts | lessons, progress state, forward-only triggers | No | Full activity/grade engines were rejected; xAPI client unnecessary without an LRS | Narrow state machine is easy to verify; xAPI export remains possible | `not_started` → `in_progress` → `completed`, with terminal completion |
| PostgreSQL persistence | 1 + 3 + 5 | PostgreSQL 17 transactions, constraints, locks, triggers, RLS | `packages/postgres` | No | Kysely/Drizzle were considered; neither replaces exact migration, RLS, and transaction requirements without adding runtime weight | Plain SQL is portable and transparent but requires disciplined tests | Domain repositories plus explicit additive SQL |
| Supabase integration | 1 + 3 + 5 | Supabase migrations, RLS, generated types, advisors; `supabase-js` v2.105.3 | migrations and row mappings | No | `supabase-js` is deferred to the private app; public core must remain transport/project neutral | Keeps project identifiers and credentials out of public source | Supabase is deployment infrastructure, not the identity system |
| Database migrations | 3 + 5 | PostgreSQL/Supabase migration behavior | six WO-003/WO-004 append-only migrations | No | ORM-generated migrations cannot safely model existing data backfills and policy hardening | Static destructive-operation tests and live rollback probes are required | Existing classroom schema extended, never replaced |
| Validation | 1 + 5 | TypeScript strict mode; Zod v4.4.3 | explicit guards, domain validators, SQL constraints | No | Zod is mature and MIT, but not installed because no external JSON route is shipped in public core | Reevaluate Zod when the private HTTP boundary appears; avoid hand-building large parsers | Compile-time types plus narrow runtime guards and database checks |
| Token generation | 1 + 3 + 5 | Web Crypto `getRandomValues`; RFC 3986 | `access-security.ts` | No | Native Web Crypto replaces a custom RNG or UUID package | Security updates remain with runtime implementation | At least 32 random bytes, base64url without padding |
| Token hashing | 1 + 3 + 5 | Web Crypto `SubtleCrypto.digest`, SHA-256 | digest service and constant-time comparison boundary | No | Native Web Crypto replaces crypto wrappers | No custom cryptographic primitive; digests only are persisted | Invitation and session bearer values never enter storage |
| Invitation issuance | 4 + 5 | Common magic-link patterns; existing invitation schema | invitation service and issue RPC | No | Auth/magic-link packages were rejected because they require user accounts, OTP, Supabase Auth, or their own session model | Raw token returned once; issuance must remain idempotent | Reusable enrollment-bound invitation rather than account login |
| Invitation exchange | 3 + 5 | HTTP redirect/cache semantics; PostgreSQL advisory locks | exchange service/RPC, clean redirect | No | Framework auth middleware cannot express entitlement/course-run checks without coupling | Transaction lock and unique active-session index constrain races | One click exchanges digest for opaque server session and removes token URL |
| Server-side sessions | 4 + 5 | AdonisJS Session and established server-side session patterns | `classroom_sessions`, session services | No | Adonis and similar packages are framework/storage bound; JWT-only libraries conflict with revocation | Every protected request rechecks authoritative server state | Session validity includes invitation, enrollment, run, and capability state |
| Cookie handling | 3 + 5 | RFC 6265/RFC6265bis; Fetch/Cloudflare headers | Cloudflare cookie writer | No | A small cookie package may be used in a private adapter later; core needs only a tiny deterministic serializer | HttpOnly, Secure-compatible, SameSite=Lax, narrow path | Cookie contains only opaque session token; token removed from URL |
| Revocation | 4 + 5 | Established session invalidation patterns; existing reversal model | invitation/session/entitlement revocation | No | Generic session packages do not understand durable entitlements | Database-backed state makes revocation immediate without cookie clearing | Cross-aggregate revocation preserves history/progress |
| Regeneration | 4 + 5 | Recovery/magic-link patterns | regeneration service/RPC and lineage fields | No | No maintained package fits scanner-safe reusable invitation lineage | Old invitation and associated sessions are atomically invalidated | `regenerated_from_id`/`replaced_by_id` preserve audit lineage |
| Expiration | 3 + 5 | UTC timestamp semantics; PostgreSQL scheduled cleanup patterns | expiry functions and partial indexes | No | External scheduler library is unnecessary; functions are worker-callable later | Requires future operational scheduler; validation still enforces expiry without cleanup | Expiration is stateful and emits generic events |
| Idempotency | 3 + 5 | API idempotency patterns; PostgreSQL uniqueness/advisory locks | WO-003 idempotency table reused by issue/exchange | No | Transport middleware alone cannot atomically coordinate DB writes | Deterministic replay/conflict prevents duplicate active credentials | Request hashes and response references contain no bearer value |
| Outbox events | 4 + 5 | Transactional outbox pattern | existing outbox table and access triggers | No | ORM/broker outbox packages were rejected because no ORM/broker exists | Atomic event recording avoids state/event divergence; publisher remains future work | Generic identifiers/state only, no token/cookie/personal payload |
| Cloudflare adapters | 3 + 5 | Cloudflare Workers Web APIs, Fetch, Web Crypto | `packages/cloudflare` | No | Hono v4.12.23 is a good future private route candidate, but public core must not select a router | Interfaces keep runtime-specific handling testable and replaceable | Ports for cookies, redirects, request metadata, clock, randomness, hashing |
| API/service/repository separation | 4 + 5 | Ports-and-adapters/hexagonal architecture | package and interface boundaries | No | Dependency-injection frameworks are unnecessary at current size | Explicit seams improve tests and future upgrades | Plain TypeScript interfaces instead of a container/framework |
| Learning-event vocabulary | 3 + 4 + 5 | xAPI 1.0.3/2.0 concepts; common LMS events | enrollment, lesson, and access event names | No | Full xAPI statements/client rejected because no LRS integration is in scope | Vocabulary is intentionally small; later adapter can map to xAPI | Events are internal domain facts, not claims of xAPI conformance |
| Authorization contracts | 4 + 5 | Capability/RBAC patterns; LMS release/tier checks | course/lesson/resource capability decisions | No | Generic RBAC packages do not model course release, enrollment expiry, and tier capability together | Centralized decisions reduce inconsistent route checks | Generic capability IDs; no Sunflower-specific tier constants in public core |

## Direct dependency inventory

### Runtime npm dependencies

None. `package-lock.json` contains only local MadLogic workspace links.

### Build and verification dependencies

- `typescript@5.8.3` — Apache-2.0; installed by CI with `--no-save --ignore-scripts`.
- Node.js 22 — CI runtime and standard library, including `node:test`.
- `actions/checkout@v4` and `actions/setup-node@v4` — CI actions.

### Platform primitives intentionally reused

- Web Crypto for secure randomness and SHA-256.
- PostgreSQL 17 for transactions, row locking, advisory locking, constraints, indexes, triggers, and RLS.
- Supabase for hosted Postgres, migration execution, generated TypeScript types, and advisors.
- Cloudflare/Fetch-compatible Web APIs as the runtime contract.

## Duplicate-wheel findings

No substantial custom component presently duplicates a mature permissively licensed package that can be substituted without changing the approved architecture.

- **Validation:** Zod should be adopted at the later private JSON/HTTP boundary if route schemas grow. It would not replace domain transitions or SQL constraints today.
- **Private Supabase transport:** use `supabase-js`; do not build a custom REST client.
- **Private Cloudflare routing:** Hono is a strong candidate; do not bind the public core to it.
- **Cryptography:** already delegated to Web Crypto; do not introduce custom cryptographic algorithms.
- **UUIDs:** runtime `crypto.randomUUID()` is sufficient; `uuid` is unnecessary now.
- **Sessions:** framework session packages were rejected because they are router/framework bound and generally do not implement entitlement-aware revocation.

## AGPL/GPL confirmation

No AGPL or GPL source code was copied, translated, adapted, linked, or vendored. Canvas, Open edX, ClassroomIO, Wellms/EscolaLMS, and Moodle remain architecture references only. No provenance evidence supports describing MadLogic Learning Core as derived from any of them.

## Recommended public description

> MadLogic Learning Core is a clean-room, lightweight TypeScript learning core informed by established open-source learning platforms and built from documented, permissively licensed dependencies and public standards.
