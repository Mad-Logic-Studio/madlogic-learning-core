# Persistence Contracts

The PostgreSQL package defines provider-neutral persistence behavior without selecting a client library or opening a database connection.

## Versioned writes

New aggregates use `expectedVersion: null` and must begin at version 1. Existing aggregates require the caller's expected version, and the replacement must increment by exactly one. Missing, duplicate, stale, and skipped-version writes fail explicitly.

## Idempotency

An idempotency key is bound to an operation name and request hash. An identical replay returns the existing claim or result. Reuse with different request material is a conflict. Result references must not contain private payloads or bearer credentials.

## Transactions and outbox

A unit of work supplies one transaction context to repositories. Domain writes, idempotency state, and outbox records may share that context. If the operation fails, none of those changes commit. Outbox publication is outside the transaction and must be retryable.

## Migrations

Migration names use `YYYYMMDDHHMMSS_description.sql`, sort lexicographically, and are append-only after application. Each migration is transactional unless an ADR documents why that is impossible.

## Conformance fixtures

The in-memory fixture is synthetic test infrastructure, not a production database. It verifies insert/load behavior, expected-version updates, stale-write rejection, idempotent replay, and transaction rollback. Future adapters must run the same public conformance expectations.
