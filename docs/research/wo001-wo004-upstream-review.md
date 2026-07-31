# WO-001 through WO-004 Upstream Review

## Purpose

This record supports the reuse/provenance gate. It identifies the sources inspected, the scope of inspection, and the resulting reuse decision. It is not a derivation claim and does not imply endorsement by any upstream project.

## LMS repositories

### Moodle

- Repository: `moodle/moodle`
- Snapshot: `70771c10954e532fce2c25874dffc57259550e25`
- License observed: GPL-3.0
- Reviewed for: learner/course vocabulary, enrollment boundaries, course/module organization.
- Decision: architecture reference only. PHP runtime, broad product scope, plugin system, account model, and GPL license are incompatible with the lightweight TypeScript/Cloudflare public core.
- Source copied: none.

### Canvas LMS

- Repository: `instructure/canvas-lms`
- Snapshot: `1c9f0bb8013ed69c4f2efe11fd483025469b7e6c`
- License observed: AGPL-3.0
- Reviewed for: courses/sections, enrollment/access boundaries, UX expectations.
- Decision: architecture reference only. The Ruby application, institutional product scope, and AGPL license make direct reuse inappropriate.
- Source copied: none.

### Open edX Platform

- Repository: `openedx/openedx-platform`
- Snapshot: `8915b9161af68e4584224b86023babc8ecfd3e9e`
- License observed: AGPL-3.0 unless otherwise noted upstream.
- Reviewed for: reusable course content versus scheduled course runs, progress and operational separation.
- Decision: architecture reference only. The Python/Django platform, service ecosystem, identity model, and AGPL license are outside the approved stack.
- Source copied: none.

### Other WO-001 references

ClassroomIO, Wellms/EscolaLMS, LearnHouse, CourseLit, and Better Auth were reviewed at architecture or UX level under the WO-001 clean-room policy. None is embedded, linked, copied, or claimed as the project base. Before any future reuse, the exact package/file license and current maintenance state must be reverified.

## Permissive libraries evaluated

### Zod

- Repository/package: `colinhacks/zod` / `zod`
- Snapshot: v4.4.3, release commit `1fb56a5`
- License: MIT
- Evaluation: mature TypeScript runtime schema validation.
- Decision: do not install in the public core yet. Current external request routing is not shipped; domain transitions and SQL constraints would remain custom even with Zod. Adopt at the private HTTP/JSON boundary if request schemas become substantial.

### uuid

- Repository/package: `uuidjs/uuid` / `uuid`
- Snapshot: v13.0.2, release commit `bd34976`
- License: MIT
- Evaluation: RFC-compliant UUID generation/parsing.
- Decision: not required. Runtime-native `crypto.randomUUID()` and Web Crypto random bytes cover current opaque-ID needs.

### supabase-js

- Repository/package: `supabase/supabase-js` / `@supabase/supabase-js`
- Snapshot: v2.105.3, release commit `84a729b`
- License: MIT
- Evaluation: database/RPC client for the later private application.
- Decision: preferred for private integration; intentionally absent from the public framework-neutral core.

### Hono

- Repository/package: `honojs/hono` / `hono`
- Snapshot: v4.12.23 release line
- License: MIT
- Evaluation: lightweight Web Standards router with Cloudflare support.
- Decision: strong private route-layer candidate. Not installed publicly because the core exposes framework-neutral services and adapters and must not select an application router.

### AdonisJS Session

- Repository/package: `adonisjs/session`
- Snapshot: release line inspected 2026-04-09
- License: MIT
- Evaluation: mature framework session package.
- Decision: architecture reference only. It is coupled to AdonisJS middleware and storage conventions and does not provide entitlement-aware cross-aggregate revocation for this learner flow.

## Public specifications and platform contracts

- W3C Web Cryptography API: secure random generation and SHA-256 digest interface.
- RFC 3986: URL syntax and safe internal destination constraints.
- RFC 6265 and RFC6265bis draft 22: cookie attributes and scope.
- RFC 9110: 303 redirect and cache-control semantics.
- RFC 9562: UUID semantics.
- PostgreSQL 17 documentation: transactions, row/advisory locking, triggers, functions, indexes, constraints, and RLS.
- Supabase platform contracts: migration execution, generated TypeScript types, RLS, and advisor checks.
- Cloudflare Workers Web APIs: Fetch-compatible requests/responses, Web Crypto, and environment binding contracts.
- xAPI 1.0.3 and current 2.0 status: event-vocabulary reference only; no conformance claim or xAPI implementation copied.

## Direct dependency result

The repository has no external runtime npm dependency. The only pinned external compiler dependency is TypeScript 5.8.3, installed in CI. Node.js, Web Crypto, PostgreSQL, Supabase, and Cloudflare-compatible Web APIs provide established runtime/platform capabilities.

## Clean-room conclusion

The code and schema delivered through WO-004 are original MadLogic implementation, except for behavior implemented from public standards and platform contracts. No permissive upstream source was copied, and no AGPL/GPL source was copied, translated, adapted, linked, or vendored.
