# WO-004 Database Verification Evidence

Date: 2026-07-30
Issue: #7
Scope: verified approved private classroom database; no private project identifier is recorded here.

## Migration chain

Applied in deterministic timestamp order:

1. `extend_access_invitations_and_sessions`
2. `add_access_management_functions`
3. `add_access_exchange_and_expiration`
4. `qualify_access_exchange_columns`

The fourth migration is an append-only corrective replacement of the exchange function. It qualifies idempotency, invitation, entitlement, cohort, session, and update references with table aliases, resolving PostgreSQL ambiguity between output parameters/PL/pgSQL names and table columns. The earlier migration was not rewritten.

All four migrations are additive. No table, column, record, history row, progress row, or existing invitation digest was removed. Static migration tests prohibit `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, destructive `DELETE FROM`, and type-rewrite operations.

## Operational row preservation

| Object | Before WO-004 | After migrations | After rollback probes |
|---|---:|---:|---:|
| classroom access invitations | 44 | 44 | 44 |
| classroom sessions | not present | 0 | 0 |
| entitlements | 37 | 37 | 37 |
| courses | 1 | 1 | 1 |
| cohorts | 1 | 1 | 1 |
| lessons | 4 | 4 | 4 |
| resources | 18 | 18 | 18 |
| lesson progress | 0 | 0 | 0 |
| entitlement status history | 74 | 74 | 74 |
| idempotency records | 0 | 0 | 0 |
| outbox events | 0 | 0 | 0 |
| purchase provisions | 24 | 24 | 24 |
| purchase reversals | 14 | 14 | 14 |
| recovery requests | 0 | 0 | 0 |
| verification rate limits | 1 | 1 | 1 |
| entitlement events | 76 | 76 | 76 |

No real learner invitation was issued. No probe row remained.

## Rollback-only live probes

The current course run was outside its active window, so the probe temporarily adjusted one existing entitlement and its course run inside a transaction. All state and generated records were rolled back.

Results:

- invitation issuance: `created`
- repeated identical issuance: same invitation returned; no duplicate row
- same idempotency key with different request hash: `conflict`
- digest-only invitation persistence: confirmed
- invitation exchange: `created`
- repeated exchange with identical idempotency input: `replay`, same session
- authoritative server-side session predicate: valid
- same-client second exchange: one active session, prior session revoked as `superseded_exchange`
- regeneration: new invitation created, prior invitation linked and invalidated, prior sessions revoked
- explicit invitation revocation: invitation revoked and one active session revoked
- session expiration: confirmed
- invitation expiration: confirmed
- entitlement status change to revoked: all active entitlement sessions revoked
- invalid invitation exchange: `denied`
- outbox events observed: `access.denied`, `access.invitation_expired`, `access.invitation_issued`, `access.invitation_regenerated`, `access.session_expired`, `access.session_revoked`, `access.session_started`
- outbox probe event count: 9
- post-rollback sessions/idempotency/outbox counts: 0/0/0

Repository unit tests also exercise concurrent exchange calls with `Promise.all`; the transactional implementation serializes the operations and leaves one active session.

## Token and event safety

Database metadata contains no column matching raw-token, cookie, bearer, or secret storage patterns. The access tables contain only digest columns:

- `classroom_access_invitations.invitation_digest`
- `classroom_access_invitations.code_digest` (legacy compatibility)
- `classroom_sessions.session_digest`
- `classroom_sessions.client_digest`

No raw invitation or session token was supplied to a migration, persisted by a probe, emitted in an outbox payload, logged, or committed.

## RLS and function permissions

Confirmed:

- RLS enabled on sessions, invitations, idempotency, and outbox tables.
- `anon` has no DML privileges on those tables.
- `authenticated` has no DML privileges on those tables.
- `service_role` retains required DML privileges.
- `classroom_sessions` has a restrictive `no_client_access_sessions` policy with `USING (false)` and `WITH CHECK (false)` for `anon` and `authenticated`.
- issue, exchange, regenerate, revoke, and expiration functions are executable by `service_role` and not executable by `anon` or `authenticated`.
- trigger-only event and entitlement-invalidation functions are not directly executable by client roles.
- every elevated WO-004 function is `SECURITY DEFINER` with an empty `search_path`.

## Index verification

Confirmed access paths include:

- active invitations by entitlement and expiry
- invitation expiration
- invitation regeneration lineage
- active sessions by entitlement
- active sessions by invitation
- session expiration
- one active session per invitation/client digest
- session refresh lineage
- unique invitation and session digests

The final performance advisor reports two informational unindexed-foreign-key notices for `replaced_by_id` and `classroom_sessions.user_id`, plus unused-index notices expected before application traffic. These do not block correctness or security. They should be reconsidered after real query/delete plans exist rather than adding speculative indexes during the feature freeze.

## Generated Supabase types

Type generation succeeded after all four migrations. Generated types include:

- invitation usage, exchange, expiration, revocation, and lineage fields
- complete `classroom_sessions` row/insert/update and relationships
- issue, exchange, regenerate, revoke, and expiration RPC signatures
- PostgREST version 14.5 metadata

No generated private type file was committed to the public repository.

## Advisor findings

Security advisor:

- no database/RLS/function warning introduced by WO-004
- one account-level warning remains: leaked-password protection is disabled in Supabase Auth
- WO-004 does not use Supabase Auth, passwords, or OTP; the warning remains documented for any unrelated future Auth usage

Performance advisor:

- two informational unindexed foreign keys noted above
- new indexes are unused because no production route has been deployed and no learner session traffic exists
- existing access indexes are retained for expected lookup, revocation, expiration, and concurrency paths

## Recovery and rollback guidance

These migrations are append-only and already applied. Do not edit or delete an applied migration.

Operational recovery should prefer forward correction:

1. stop any future access-route traffic;
2. revoke active sessions by entitlement or invitation;
3. inspect idempotency and outbox records;
4. apply a new corrective migration;
5. regenerate affected invitations only when required;
6. preserve enrollment, history, progress, and audit evidence.

Dropping the session table or removing invitation metadata is not an approved rollback because it would destroy audit and revocation evidence. The clean rollback path for application activation is to leave routes disabled; no production routes exist in WO-004.

## Failed verification actions

1. Initial live exchange verification before the corrective migration exposed PostgreSQL error `42702` for an ambiguous column reference. The corrective migration `qualify_access_exchange_columns` resolved the production function and the corrected definition was verified live.
2. A later probe script used a local variable named `client_digest`, producing PostgreSQL error `42702` inside the temporary probe. PostgreSQL aborted and rolled back the transaction. Renaming the probe variable resolved it; no production function or data changed.
3. One combined outbox/secret-scan probe was blocked by the connector safety filter before execution. The probe was split into smaller statements; event behavior and schema token-safety were then verified separately.
