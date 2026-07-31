# Reuse and Provenance Matrix

## Scope

This audit covers the public work delivered from WO-001 through WO-004. It distinguishes installed dependencies, permissive-code adaptation, public-specification adaptation, architecture-only research, and original MadLogic implementation.

Classification:

1. **Direct dependency** — installed and executed as part of the repository toolchain or runtime.
2. **Adapted permissive code** — source under MIT, Apache-2.0, BSD, or equivalent was modified or translated.
3. **Adapted public specification** — implementation follows a published standard or platform contract without copying an upstream implementation.
4. **Architecture reference only** — upstream design or behavior was studied; no source was copied or adapted.
5. **Original MadLogic implementation** — repository-specific source authored for this project from requirements and public specifications.

## Executive finding

MadLogic Learning Core is **not based on, derived from, or adapted from a single LMS repository**. The learning-domain vocabulary and boundaries were developed clean-room after architecture-level review of multiple LMS projects and standards. No Moodle GPL source, Canvas AGPL source, Open edX AGPL source, ClassroomIO AGPL source, EscolaLMS/Wellms AGPL source, or other AGPL source was copied.

The current repository intentionally avoids importing a complete LMS because those platforms bring incompatible language/runtime assumptions, product scope, account systems, authoring stacks, and deployment requirements. Working custom code is not being replaced merely to claim reuse.

## Repository and specification snapshots reviewed

| Reference | Exact version or commit reviewed | License / status | Use |
|---|---|---|---|
| `moodle/moodle` | `70771c10954e532fce2c25874dffc57259550e25` (5.3dev build 20260728) | GPL-3.0 | Architecture reference only; no code copied |
| `instructure/canvas-lms` | `1c9f0bb8013ed69c4f2efe11fd483025469b7e6c` | AGPL-3.0 | Architecture reference only; no code copied |
| `openedx/openedx-platform` | `8915b9161af68e4584224b86023babc8ecfd3e9e` | AGPL-3.0 | Architecture reference only; no code copied |
| `colinhacks/zod` | v4.4.3, release commit `1fb56a5` | MIT | Evaluated as a possible validation dependency; not installed |
| `uuidjs/uuid` | v13.0.2 | MIT | Evaluated for opaque identifiers; not installed because runtime-native secure bytes are sufficient |
| `supabase/supabase-js` | v2.105.3, release commit `84a729b` | MIT | Evaluated for future private application integration; not installed in the public core |
| `adonisjs/session` | release line inspected 2026-04-09 | MIT | Session architecture reference only; framework coupling made direct reuse inappropriate |
| TypeScript | 5.8.3 | Apache-2.0 | Direct development/build dependency |
| ECMAScript / Web Crypto API | Web Cryptography Level 2 and runtime Web Crypto implementation | Public specification | Secure random generation, SHA-256 digesting, constant-time comparison boundary |
| RFC 3986 | URI Generic Syntax | IETF standard | URL-safe token and internal redirect constraints |
| RFC 6265 / current cookie specification | HTTP State Management Mechanism | IETF standard | Cookie attributes and scope |
| RFC 9110 | HTTP Semantics | IETF standard | Redirect, cache, and response semantics |
| RFC 9562 | UUIDs | IETF standard | Opaque identifier expectations; no UUID library required in the framework-neutral core |
| PostgreSQL | 17.x documentation and SQL behavior | PostgreSQL License | Transactions, constraints, indexes, advisory locks, triggers, RLS-compatible schema design |
| Supabase | Hosted PostgreSQL, generated types, RLS and advisor contracts | Platform service; underlying OSS components vary | Deployment and verification target; no Supabase Auth use |
| Cloudflare Workers Web APIs | Workers runtime contracts | Platform documentation | Adapter boundary for requests, cookies, redirects, crypto, clocks, and bindings |
| xAPI | 1.0.3 vocabulary reviewed | Public specification | Learning-event vocabulary reference only; no xAPI package or statement model copied |

## Subsystem matrix

| Subsystem | References reviewed | Classification | Code/dependency/data-model treatment | Files or concepts influenced | Why direct reuse was or was not appropriate | Mature permissive replacement? | Maintenance and security implications |
|---|---|---|---|---|---|---|---|
| Learner and course domain model | Moodle, Canvas, Open edX, xAPI | 4 + 5 | Common LMS nouns studied; types authored independently | `packages/core/src/index.ts` | Full LMS models are coupled to assignments, grading, institutions, roles, and authoring systems outside scope | No small library usefully replaces project-specific domain boundaries | Small model is easier to audit; future interoperability mapping remains possible |
| Course-run / cohort model | Moodle course instances, Canvas courses/sections, Open edX course runs | 4 + 5 | Conceptual separation of reusable course and scheduled run implemented independently | `Course`, `CourseRun`, `classroom_courses`, `classroom_cohorts` | Upstream schemas are product-specific and copyleft | No focused permissive package identified | Explicit boundary prevents Sunflower-specific schedule rules leaking into reusable core |
| Enrollment model | LMS enrollment concepts and existing classroom entitlements | 4 + 5 | Existing entitlement table adapted into generic domain mapping; no upstream LMS schema copied | Enrollment contracts, status history, Supabase mappings | Existing private schema was the authoritative migration target | No library replaces business-state invariants | Versioning and append-only history reduce silent state loss |
| Lesson and progress model | LMS lesson/module/progress concepts, xAPI completion vocabulary | 3 + 4 + 5 | Clean-room minimal state model | lesson/progress contracts, tables, triggers | Mature LMS implementations carry grading and activity engines not required here | xAPI libraries could be added later only for external statement exchange | Forward-only completion and durable timestamps are deliberately narrow |
| PostgreSQL persistence | PostgreSQL 17 docs | 3 + 5 | Repository contracts, optimistic concurrency, transactions, indexes and triggers authored for the domain | `packages/postgres` | ORM adoption would add runtime weight and obscure exact RLS/transaction behavior | Kysely/Drizzle were candidates, but neither replaces migration-specific SQL or domain repositories without added dependency cost | Plain SQL is portable and reviewable; requires disciplined migration tests |
| Supabase integration | Supabase PostgreSQL/RLS/type-generation APIs; `supabase-js` v2.105.3 | 3 + 5 | Uses hosted Postgres and generated types; public package exposes mappings, not a Supabase client | migrations, `supabase.ts`, access mappings | Public core must not depend on a client library or project identity; private application may use `supabase-js` later | `supabase-js` is the likely private integration dependency, not a public-core requirement | Keeps secrets and project coupling out of public repository |
| Token issuance and hashing | Web Crypto, RFC 3986; UUID library evaluated | 3 + 5 | Runtime crypto port plus original token service | `access-security.ts`, invitation services | Web Crypto is already available in Node/Cloudflare; another crypto wrapper would duplicate platform primitives | No replacement justified; native Web Crypto is the maintained implementation | Minimum 32 random bytes, URL-safe encoding, SHA-256 digest-only persistence |
| Session storage and validation | Adonis session, Open edX safe sessions, OWASP-style server-side session principles | 4 + 5 | Opaque server-side sessions authored independently | session contracts/services, `classroom_sessions` | Framework session packages bind to framework middleware, cookie conventions, or storage drivers | A framework package could be used in a future adapter, but not in the framework-neutral core | Server lookup on every protected request makes revocation immediate |
| Cookie handling | RFC 6265, Cloudflare/Fetch headers | 3 + 5 | Cookie directives and adapter contracts authored from standards | Cloudflare adapter contracts | Framework cookie packages would pull routing/runtime coupling into core | Native header serialization or a small MIT cookie package may be used by a private adapter later | HttpOnly, Secure-compatible, SameSite=Lax, narrow path, no token in URL after exchange |
| Revocation | Session-security patterns; existing entitlement reversal model | 4 + 5 | Invitation, session, and entitlement-wide invalidation authored for this lifecycle | services, triggers, management functions | Generic session packages do not understand durable learning entitlements | No library replaces cross-aggregate revocation semantics | Database-backed state prevents stale self-contained credentials from surviving revocation |
| Idempotency | HTTP/API idempotency patterns; PostgreSQL uniqueness/advisory locks | 3 + 5 | Existing WO-003 idempotency table reused; access commands integrated | idempotency records, issuance/exchange services | Third-party middleware is transport-specific and cannot enforce database transaction coupling | A private HTTP adapter may later use permissive middleware, but core records remain necessary | Deterministic conflicts and replay results prevent duplicate invitations/sessions |
| Outbox events | Transactional outbox architectural pattern | 4 + 5 | Existing WO-003 outbox reused and extended with generic access events | outbox table/triggers/event vocabulary | Libraries usually assume a specific ORM, broker, or worker | A future publisher can use a maintained queue/client package; no broker is needed yet | Atomic database event recording avoids state/event divergence |
| Validation | TypeScript strict mode; Zod v4.4.3 evaluated | 1 + 5 | Compile-time contracts and explicit domain validation currently used | domain validators and service input checks | Zod is mature and MIT, but installing it now would add runtime weight without replacing database constraints or domain transitions | **Candidate:** Zod could replace repetitive boundary parsing when external JSON routes are introduced | Reassess in private route integration; do not duplicate large schema parsers manually |
| Database migrations | PostgreSQL 17, Supabase migration execution | 3 + 5 | Append-only SQL migrations authored for existing schema | `packages/postgres/migrations` | ORM migration generators cannot safely infer preservation/backfill/RLS needs for this live schema | No replacement justified for these migrations | Static destructive-operation tests plus live rollback verification are required |
| Cloudflare runtime adapters | Cloudflare Workers/Fetch/Web Crypto APIs | 3 + 5 | Ports for cookies, redirects, request metadata, bindings, clock, hashing and random bytes | `packages/cloudflare` | Framework middleware would bind the core to Astro/Hono/React Router | Hono or similar MIT frameworks may be used by a private route layer later, not by core | Keeps portability across Workers-compatible frontends |
| API/service separation | Hexagonal/ports-and-adapters architecture | 4 + 5 | Framework-neutral services and persistence/runtime ports | package boundaries | Full dependency-injection frameworks are unnecessary at current size | No replacement justified; TypeScript interfaces are sufficient | Explicit seams make security testing and future adapters easier |
| Learning-event vocabulary | xAPI 1.0.3, common LMS events | 3 + 4 + 5 | Small generic vocabulary authored independently | `LearningEventName`, access outbox events | Full xAPI statement machinery is outside current delivery needs | A maintained xAPI client can be added only if an external Learning Record Store is introduced | Current payloads minimize personal data and exclude tokens/cookies |

## Actual code and packages reused

- TypeScript 5.8.3 is the direct compiler/toolchain dependency.
- Node.js and Cloudflare-compatible Web Crypto implementations provide secure random generation and SHA-256 primitives.
- PostgreSQL supplies transactions, constraints, indexes, triggers, advisory locks, and row-level security mechanisms.
- Supabase supplies the hosted PostgreSQL environment, migration execution, generated TypeScript types, and advisor tooling.

No LMS repository source files were copied or modified into MadLogic Learning Core. No permissively licensed LMS package is currently embedded in the runtime.

## Components intentionally not rebuilt

- cryptographic primitives: delegated to Web Crypto
- database transaction engine, locking, constraints, indexes, and RLS: delegated to PostgreSQL/Supabase
- TypeScript compiler and module system: delegated to TypeScript/Node
- browser cookie and HTTP semantics: implemented against IETF/platform standards rather than inventing a protocol
- UUID generation in deployment adapters: delegated to runtime-native `crypto.randomUUID()` where appropriate
- future JSON route parsing: Zod remains the preferred candidate when external request schemas justify it
- future private Supabase transport: `supabase-js` remains the preferred candidate rather than a custom REST client

## Custom implementation that remains justified

- minimal learner/course/course-run/enrollment model
- mapping of the existing classroom schema into reusable domain contracts
- reusable email invitation lifecycle that tolerates scanner prefetch
- entitlement-aware server-side session validation and revocation
- clean redirect and protected-resource authorization decisions
- cross-aggregate idempotency and event semantics
- Cloudflare-neutral ports that avoid binding the core to one frontend framework

These components express the approved learner experience and existing database constraints. No mature permissive library was identified that replaces them without importing a framework, account system, storage technology, or full LMS product.

## AGPL and copyleft confirmation

No AGPL source code was copied, translated, adapted, or linked into the repository. Canvas and Open edX were architecture references only. Moodle GPL source was also not copied or adapted. Copyleft projects remain documented as research references, not dependencies or derivation claims.
