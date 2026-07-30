# Work Order 001 — Foundation build journal

- **Date:** 2026-07-30
- **Repository:** `Mad-Logic-Studio/madlogic-learning-core`
- **Issue:** #1
- **Branch:** `feature/wo-001-foundation`
- **Private consumer:** `Mad-Logic-Studio/socialmedium` issue #12; private code not modified

## Why the project exists

MadLogic Learning Core provides a small public learning-engine foundation for custom, headless learner experiences while private consumers retain proprietary content, data, integrations, and credentials.

## Foundation decisions

- public reusable core with private production consumers
- framework-neutral strict TypeScript domain contracts
- durable enrollment evidence separated from disposable access links
- npm workspace boundaries for core, PostgreSQL, Cloudflare, and a safe example
- clean-room upstream research with no copied source
- dependency-free local quality scripts and Node built-in tests

## Upstream projects reviewed

ClassroomIO, Wellms/EscolaLMS, LearnHouse, CourseLit, and Better Auth. Individual records are in `docs/research/`. No source code was copied.

## Files created

Workspace configuration, three packages, one generic example, domain tests, governance documents, five ADRs, research records, public/private boundary and integration documents, community templates, CI, Dependabot configuration, notices, and this journal.

## Tests and verification

Local verification completed against Node.js 22.16.0, npm 10.9.2, and TypeScript 5.8.3:

- `npm run format:check` — pass
- `npm run lint` — pass
- `npm run typecheck` — pass
- `npm test` — pass; 2 tests, 2 passed, 0 failed
- package build — pass for core, postgres, cloudflare, and the generic example
- `npm run security:scan` — pass; 0 findings
- local npm audit — 0 vulnerabilities

GitHub's `actions/dependency-review-action@v4` was attempted on draft PR #2 but failed because the repository dependency graph is not enabled. The unsupported workflow was removed rather than preserving a false failing check. Dependency protection remains through the deterministic workspace lockfile, `npm audit --omit=dev --audit-level=high` in CI, and weekly Dependabot configuration. Enabling the repository dependency graph is a future administrative option.

GitHub Actions results are recorded in the draft pull request after the supported workflow completes.

## Security review

The source contains no production credentials, raw access tokens, signing keys, private learner data, private destinations, provider IDs, or proprietary curriculum. AccessLink exposes only a token-hash field. Production token issuance is intentionally not implemented.

## Public/private boundary review

All examples are synthetic. Public interfaces remain provider-neutral. The private consumer repository and its integration branch were not modified.

## Known limitations

- initial contracts are preliminary and do not enforce every invariant at runtime
- no database migrations or production adapters
- no token issuance, session validation, or authentication
- no Astro, Supabase, or Cloudflare implementation dependency in the compile-only example
- upstream commits and licenses require exact pinning before any future code reuse
- GitHub dependency review is unavailable until the repository dependency graph is enabled

## Next milestone

Work Order 002 should refine domain invariants and persistence contracts, add migration architecture and adapter conformance tests, and prepare the threat model for one-click access without implementing a private consumer.
