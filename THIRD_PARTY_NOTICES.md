# Third-Party Notices

This document distinguishes direct dependencies, specification-based implementation, permissive-code adaptation, and architecture-only research. Research does not imply endorsement by an upstream project.

## Direct dependencies and platform primitives

| Project / standard | Exact version reviewed or used | License / status | Treatment |
|---|---|---|---|
| TypeScript | 5.8.3 | Apache-2.0 | Direct compiler/build dependency |
| Node.js / Cloudflare Web Crypto | Web Cryptography API implementation | Public web-platform API | Runtime primitive for secure random generation and SHA-256; no upstream implementation copied |
| PostgreSQL | 17.x | PostgreSQL License | Database engine and documented SQL behavior |
| Supabase | Hosted PostgreSQL project, generated types, migration and advisor tooling | Platform service; components carry their own licenses | Deployment and verification platform; no Supabase Auth integration |
| RFC 3986 | URI Generic Syntax | IETF standard | URL and redirect constraints |
| RFC 6265 | HTTP State Management Mechanism | IETF standard | Cookie semantics |
| RFC 9110 | HTTP Semantics | IETF standard | Redirect/cache response behavior |
| RFC 9562 | UUIDs | IETF standard | Identifier expectations |
| xAPI | 1.0.3 | Public specification | Event-vocabulary reference only |

## Permissive components evaluated but not installed

| Project | Exact version or release reviewed | License | Decision |
|---|---|---|---|
| Zod | v4.4.3, release commit `1fb56a5` | MIT | Strong candidate for future private HTTP/JSON boundary validation; not needed to replace current domain and database validation |
| uuid | v13.0.2 | MIT | Not installed because runtime-native secure randomness and `crypto.randomUUID()` cover current needs |
| supabase-js | v2.105.3, release commit `84a729b` | MIT | Expected candidate for later private application integration; public core remains transport-neutral |
| AdonisJS Session | release line inspected 2026-04-09 | MIT | Architecture reference only; direct reuse would couple the core to AdonisJS middleware and storage conventions |

No permissively licensed source code was copied or adapted in WO-001 through WO-004. The evaluated components above remain possible future dependencies where they replace real adapter work without distorting the architecture.

## LMS architecture references

| Project | Exact commit reviewed | License | Code reused | Treatment |
|---|---|---|---:|---|
| Moodle | `70771c10954e532fce2c25874dffc57259550e25` | GPL-3.0 | No | Architecture and domain-vocabulary reference only |
| Canvas LMS | `1c9f0bb8013ed69c4f2efe11fd483025469b7e6c` | AGPL-3.0 | No | Architecture and UX reference only |
| Open edX Platform | `8915b9161af68e4584224b86023babc8ecfd3e9e` | AGPL-3.0 | No | Architecture and operational reference only |
| ClassroomIO | WO-001 recorded snapshot | AGPL restrictions recorded in WO-001 research | No | Architecture and UX reference only |
| Wellms / EscolaLMS | WO-001 recorded snapshot | AGPL restrictions recorded in WO-001 research | No | Architecture and UX reference only |
| LearnHouse | WO-001 recorded snapshot | License must be reverified before any reuse | No | Architecture and UX reference only |
| CourseLit | WO-001 recorded snapshot | License must be reverified before any reuse | No | Architecture and UX reference only |
| Better Auth | WO-001 recorded snapshot | File-level license review required before reuse | No | Authentication architecture reference only |

## Classification definitions

1. **Direct dependency:** installed package or runtime/platform component used by the repository.
2. **Adapted permissive code:** MIT, Apache-2.0, BSD, or equivalent source modified for this project.
3. **Adapted public specification:** implementation follows a published standard without copying an upstream implementation.
4. **Architecture reference only:** design or behavior studied under clean-room rules.
5. **Original MadLogic implementation:** source authored for this repository from requirements and public specifications.

## Copyleft and AGPL confirmation

No AGPL or GPL source code was copied, translated, adapted, linked, or vendored into MadLogic Learning Core. Canvas, Open edX, Moodle, ClassroomIO, and Wellms/EscolaLMS were research references only. MadLogic Learning Core must not be described as based on or derived from those repositories.

See `docs/research/reuse-provenance-matrix.md` and the other `docs/research/` records for the complete subsystem-level assessment.
