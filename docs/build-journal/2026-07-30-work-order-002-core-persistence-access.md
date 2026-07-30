# Build Journal — Work Order 002

- **Date:** 2026-07-30
- **Issue:** #3
- **Branch:** `feature/wo-002-core-persistence-access-threat-model`
- **Stacked base:** `feature/wo-001-foundation` at `bb4c8935053131d6944e0ff8a3d09b2678766033`

## Purpose

Turn the preliminary vocabulary into explicit domain lifecycle rules and testable persistence contracts while keeping production authentication and the private consumer out of scope.

## Decisions

- append-only enrollment status evidence
- terminal enrollment states do not reactivate
- disposable links remain separate from enrollment
- digest-only access-link persistence
- optimistic concurrency for aggregate writes
- operation-and-request-bound idempotency
- transactional domain mutation plus outbox record
- reusable public conformance tests with a synthetic in-memory fixture

## Files and capabilities

- expanded core domain contracts and transition functions
- PostgreSQL contracts for repositories, transactions, idempotency, and outbox
- in-memory transaction fixture and conformance harness
- one-click access threat model
- persistence architecture guide
- ADR-0006 through ADR-0010
- expanded domain and persistence test suites

## Verification

Local verification used Node.js 22.16.0, npm 10.9.2, and TypeScript 5.8.3.

- formatting: pass
- lint: pass
- strict type check: pass
- package build: pass
- tests: 9 passed, 0 failed
- repository security scan: pass, 0 findings

GitHub CI evidence is recorded in the stacked draft PR after execution.

## Security review

No cryptographic generation or verification implementation was added. Synthetic digests are non-secret. No token, credential, private URL, learner data, provider mapping, or production configuration is present.

## Public/private boundary review

Only generic contracts, synthetic fixtures, tests, and security architecture were added publicly. The private consumer repository and its integration branch were not modified.

## Provenance

No upstream source code was copied, adapted, or reused. WO-001 research records remain the provenance source of truth.

## Known limitations

- no real PostgreSQL adapter or SQL migration
- no cryptographic implementation
- no session-cookie implementation
- no rate limiter or production telemetry
- no progress-state transition model yet
- in-memory transactions model behavior, not PostgreSQL isolation levels

## Next milestone

Implement reviewed PostgreSQL schemas and migration tests, followed by cryptographic adapter contracts and a reference access-verification service under a separate work order.
