# ADR-0012: Digest-Only Reusable Access Invitations

- Status: Accepted for WO-004
- Date: 2026-07-30
- Issue: #7

## Context

Learners need a one-click email entry path without passwords, OTPs, a second email, or a generic identity-provider screen. Email-security systems may prefetch links before a learner clicks them. A strictly single-use link can therefore be consumed by a scanner and fail for the intended learner.

Enrollment is durable. An invitation is only a disposable way to begin a browser session.

## Decision

Use cryptographically random, URL-safe invitation tokens with at least 32 bytes of entropy. Return the raw token only at initial issuance or regeneration. Persist only its SHA-256 digest.

New learner invitations use a reusable-until-expiry-or-revocation policy. Validation is read-only. Successful exchanges may create controlled server-side sessions while leaving the invitation available for later entry. Idempotency, transaction-level locking, invitation versioning, expiration, revocation, and regeneration constrain replay and concurrent operations.

The entry response uses a fixed/allowlisted internal destination, `Cache-Control: no-store`, and `Referrer-Policy: no-referrer`, and immediately redirects to a URL that contains no invitation token.

Historical single-use records remain supported for compatibility.

## Consequences

- Email scanner prefetch does not consume a reusable invitation.
- Forwarding the personalized email can share access until the invitation is revoked or regenerated; this is an accepted small-cohort tradeoff and must be documented operationally.
- Regeneration invalidates the prior invitation and its active sessions while preserving enrollment, history, progress, and events.
- Raw invitation values must never appear in database rows, logs, events, routine admin lists, analytics URLs, or repository content.
- Server-side sessions, not the invitation URL alone, authorize protected requests.

## Alternatives rejected

- Password accounts or OTP: violate the approved learner experience.
- Supabase Auth magic links: introduce a separate identity/session model and provider UI.
- Strict single-use email links: vulnerable to scanner prefetch.
- Permanent secret URL: lacks server-side session controls and practical revocation boundaries.
- JWT-only authorization: remains valid after server-side revocation unless additional state is checked.

## Provenance

This decision is an original MadLogic implementation informed by public HTTP/Web Crypto specifications and established magic-link threat patterns. No LMS, auth-library, AGPL, or GPL source code was copied or adapted.
