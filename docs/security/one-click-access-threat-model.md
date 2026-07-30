# One-Click Access Threat Model

Status: approved architecture for WO-002; implementation remains future work.

## Assets and trust boundaries

Protected assets are durable enrollment rights, private learning resources, learner identity references, access-link digests, sessions, and audit evidence. Raw link tokens cross an untrusted email/browser boundary and must be treated as bearer credentials. Public frontends, runtime adapters, persistence adapters, email providers, and private consumers are separate trust boundaries.

## Threats and required controls

| Threat | Required control |
| --- | --- |
| Token guessing | Generate at least 128 bits of cryptographically secure entropy; use URL-safe encoding; return indistinguishable failures. |
| Database disclosure | Persist only a versioned cryptographic digest, never the raw token. Keep algorithm identifiers and rotation metadata separate from secret material. |
| Timing attacks | Compare candidate and stored digests with a constant-time primitive supplied by the runtime adapter. |
| Replay | Define each link as `single_use` or `reusable`; consume single-use links atomically with session creation; rotate sessions after successful entry. |
| Expired or revoked links | Evaluate current time and revocation state before creating or refreshing a session. Revocation must take effect without deleting enrollment evidence. |
| Enumeration | Avoid learner-specific error text, rate-limit by multiple signals, and do not expose whether an enrollment exists. |
| Session theft | Use secure, HTTP-only, same-site cookies; bounded absolute and idle lifetimes; rotation; server-side revocation; and origin-aware CSRF defenses where state changes occur. |
| Logging leakage | Never log raw tokens, cookie values, full URLs containing tokens, token digests, private destinations, or learner-sensitive payloads. Redact query strings at ingress. |
| Link forwarding | Prefer single-use links for sensitive material. Reusable links require explicit policy, shorter lifetime, revocation controls, and risk acceptance. |
| Race conditions | Verify and consume links under optimistic concurrency inside one transaction. A stale version must fail closed. |
| Duplicate commands | Require an idempotency key and request hash; identical replays return the original result, while changed requests conflict. |
| Partial publication | Persist the domain mutation and outbox event in the same transaction. Publication occurs after commit and is retryable. |
| Incident response | Support enrollment-level and link-level revocation, session invalidation, digest-algorithm rotation, audit review, and forced reissue. |

## Token lifecycle

1. A runtime cryptography adapter generates a high-entropy candidate token.
2. The raw candidate is exposed only at the issuance boundary long enough to construct the delivery URL.
3. A versioned digest is persisted with link policy, expiry, status, and aggregate version.
4. Redemption resolves a candidate to a digest without storing or logging the candidate.
5. Enrollment status, link status, expiry, and policy are evaluated.
6. Single-use consumption and session creation occur atomically.
7. The session is rotated and bounded; the link remains as audit evidence.
8. Revocation or expiry changes access state without deleting enrollment history.

## Data minimization

Core contracts use opaque identifiers and do not require email addresses, names, provider IDs, curriculum, or private destinations. Private consumers map their operational data outside this repository.

## Explicit non-implementation

WO-002 does not implement cryptographic generation, hashing, cookie serialization, authentication, rate limiting, email delivery, database migrations, or production runtime integration. Those require separate issues, threat-model review, and adapter-specific tests.
