# Third-Party Notices

This repository is Apache-2.0 licensed. This notice distinguishes direct dependencies and platform primitives from research-only references. Research does not imply upstream endorsement or derivation.

## Direct dependency inventory

### Third-party runtime npm packages

**None.** The lockfile contains only local MadLogic workspace packages.

### Build and CI dependencies

| Component | Version/reference | License/status | Use |
|---|---|---|---|
| TypeScript | 5.8.3 | Apache-2.0 | Pinned compiler installed by CI |
| Node.js | 22 | Node.js licenses | Build/test runtime and standard library |
| `actions/checkout` | v4 | GitHub Action | Repository checkout in CI |
| `actions/setup-node` | v4 | GitHub Action | Node installation and npm cache in CI |

### Platform and standards dependencies

| Component/standard | Version/reference | License/status | Use |
|---|---|---|---|
| Web Cryptography API | W3C Recommendation 2017; Level 2 draft 2025 | Public web specification | Secure random bytes, `randomUUID`, and SHA-256 digest operations |
| PostgreSQL | 17.x | PostgreSQL License | Database, transactions, locks, constraints, triggers, indexes, functions, and RLS |
| Supabase | Hosted PostgreSQL migration/type/advisor tooling | Platform service | Approved deployment and verification environment; Supabase Auth is not used |
| Cloudflare Workers Web APIs | Web Standards runtime contracts | Platform documentation | Target adapter environment |
| RFC 3986 | URI Generic Syntax | IETF standard | URL and redirect constraints |
| RFC 6265 / RFC6265bis draft 22 | Cookies | IETF standard/draft | Cookie attributes and scope |
| RFC 9110 | HTTP Semantics | IETF standard | Redirect and cache behavior |
| RFC 9562 | UUIDs | IETF standard | Identifier semantics |
| xAPI | 1.0.3 snapshot; current 2.0 status reviewed | Apache-2.0 specification | Event-vocabulary reference only; project does not claim xAPI conformance |

## Permissive components evaluated but not installed

| Project | Snapshot reviewed | License | Decision |
|---|---|---|---|
| Zod | v4.4.3, release commit `1fb56a5` | MIT | Preferred candidate for later private HTTP/JSON boundary validation; not needed for current domain/database invariants |
| uuid | v13.0.2, release commit `bd34976` | MIT | Runtime-native `crypto.randomUUID()` and secure bytes are sufficient |
| supabase-js | v2.105.3, release commit `84a729b` | MIT | Preferred future private application client; public core remains transport-neutral |
| Hono | v4.12.23 release line | MIT | Strong future private Cloudflare route-layer candidate; not appropriate as a public-core dependency |
| AdonisJS Session | release line inspected 2026-04-09 | MIT | Architecture reference only; direct use would couple sessions to Adonis middleware and storage drivers |

No permissively licensed source code was copied or adapted. These projects were evaluated as possible dependencies and documented so later work does not rebuild mature boundary/router/client functionality unnecessarily.

## LMS architecture references only

| Project | Snapshot reviewed | License observed | Code reused? | Treatment |
|---|---|---|---:|---|
| Moodle | commit `70771c10954e532fce2c25874dffc57259550e25` | GPL-3.0 | No | Domain and architecture reference only |
| Canvas LMS | commit `1c9f0bb8013ed69c4f2efe11fd483025469b7e6c` | AGPL-3.0 | No | Architecture and UX reference only |
| Open edX Platform | commit `8915b9161af68e4584224b86023babc8ecfd3e9e` | AGPL-3.0 | No | Course-run and operational reference only |
| ClassroomIO | WO-001 recorded snapshot | AGPL-family restrictions recorded | No | Architecture and UX reference only |
| Wellms / EscolaLMS | WO-001 recorded snapshot | AGPL-family restrictions recorded | No | Architecture and UX reference only |
| LearnHouse | WO-001 recorded snapshot | Reverify before any reuse | No | Architecture reference only |
| CourseLit | WO-001 recorded snapshot | Reverify before any reuse | No | Architecture reference only |
| Better Auth | WO-001 recorded snapshot | File/package license review required before reuse | No | Authentication architecture reference only |

## Provenance statement

- MadLogic Learning Core is not a fork or derivative of a specific LMS.
- No AGPL or GPL source code was copied, translated, adapted, linked, or vendored.
- No external LMS package is embedded in the runtime.
- Project-specific domain, access, session, authorization, repository, and migration code is original MadLogic work informed by public standards and architecture-level research.

See `docs/research/reuse-provenance-matrix.md` for the subsystem-level decision record and `docs/research/wo001-wo004-upstream-review.md` for source snapshots and reuse decisions.
