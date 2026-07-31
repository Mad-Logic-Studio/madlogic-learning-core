# Work Order 004 — One-Click Access, Session Control, Revocation, and Provenance

Date: 2026-07-30
Issue: #7
Branch: `feature/wo-004-one-click-access`
Base: `feature/wo-003-postgres-supabase-persistence` at `8b25c22bffd1eeb61350441f8bee45e8d6477e0c`
Status: In progress; draft PR #8; do not merge.

## Objective

Build a reusable, framework-neutral learner-access layer that exchanges a reusable digest-only email invitation for a revocable server-side session and redirects to a clean classroom URL. Preserve durable enrollment, history, progress, and events independently from disposable invitations and browser sessions.

## Implementation milestone

The public branch contains:

- secure random invitation/session token generation through Web Crypto ports
- URL-safe token encoding and SHA-256 digest-only persistence
- reusable invitations for email-scanner tolerance
- opaque server-side sessions
- secure cookie and clean redirect contracts
- invitation, session, entitlement, course-run, lesson, resource, tier, and capability authorization decisions
- invitation regeneration and invitation/session/entitlement revocation
- idempotent issuance and exchange
- generic access lifecycle outbox events
- Cloudflare-compatible runtime ports
- PostgreSQL/Supabase mapping contracts
- three additive access migrations
- static migration safety tests and access-service tests

## Verification to date

GitHub Actions CI run #52 passed on the pre-provenance head:

- formatting
- lint
- strict TypeScript
- package builds
- 40 total repository tests
- security scan
- dependency audit

The provenance addendum subsequently added documentation-only commits. A final CI run is required before completion.

## Database progress

The approved private deployment target was reverified before DDL. The first append-only access migration was applied successfully before the provenance addendum arrived. WO-004 remains incomplete until:

- remaining reviewed migrations are applied
- live rollback-only probes pass
- all pre/post row counts are reconciled
- generated types are reviewed
- post-migration security/performance advisors are reviewed
- no test residue is confirmed

No production route, private classroom UI, DNS, MailerLite automation, Trafft webhook, or real learner invitation was created.

## Reuse and provenance addendum

The addendum requires a subsystem-level audit from WO-001 through WO-004. The audit is recorded in:

- `docs/research/reuse-provenance-matrix.md`
- `THIRD_PARTY_NOTICES.md`

### Findings

- MadLogic Learning Core is not derived from a single LMS repository.
- Moodle, Canvas, Open edX, ClassroomIO, and Wellms/EscolaLMS are architecture references only.
- No GPL or AGPL source was copied, adapted, translated, linked, or vendored.
- TypeScript 5.8.3 is the direct compiler/toolchain dependency.
- Secure random generation and hashing delegate to Web Crypto rather than custom cryptography.
- Transactions, constraints, indexes, triggers, advisory locks, and RLS delegate to PostgreSQL/Supabase rather than custom infrastructure.
- Zod is a documented future candidate for private HTTP/JSON boundary validation.
- `supabase-js` is a documented future candidate for private application transport.
- Framework session packages were not adopted because they would bind the public core to middleware, routers, cookie conventions, or storage drivers.

## Why the custom work remains justified

The custom source expresses the approved one-click learner experience and integrates with an existing classroom schema:

- scanner-safe reusable invitations
- entitlement-aware revocable sessions
- clean URL exchange behavior
- cross-aggregate revocation
- protected-resource capability decisions
- framework-neutral Cloudflare/PostgreSQL ports

No mature permissive component was identified that replaces these pieces without importing a full LMS, account system, framework runtime, external session store, or unrelated product scope.

## Restrictions still active

- do not merge WO-002, WO-003, or WO-004
- do not mark PR ready
- do not publish packages
- do not deploy production routes
- do not modify the private consumer
- do not issue invitations to real learners
- do not configure MailerLite, Trafft, or DNS

## Completion gate

Do not declare WO-004 complete until GitHub, CI, database, rollback, row-preservation, security-advisor, generated-type, and provenance evidence all support the final report.
