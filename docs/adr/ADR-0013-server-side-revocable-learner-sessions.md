# ADR-0013: Server-Side Revocable Learner Sessions

- Status: Accepted for WO-004
- Date: 2026-07-30
- Issue: #7

## Context

A learner invitation must exchange into a clean browser session. Entitlement cancellation, refund, expiration, invitation regeneration, and support revocation must take effect immediately without requiring the learner to clear cookies.

A self-contained bearer cookie or JWT that is accepted without server-side state would remain usable until its embedded expiry and would not satisfy the revocation requirement.

## Decision

Use opaque browser session tokens and store only SHA-256 digests in `classroom_sessions`. Each protected request resolves the digest and verifies authoritative server-side state:

- session is active and unexpired;
- invitation remains available;
- entitlement remains active and within its date window;
- course run remains available;
- requested course, lesson, resource, tier, and capability are permitted.

Session cookies are HttpOnly, Secure in production-compatible environments, SameSite=Lax, and narrowly scoped to the classroom path. Session exchange rotates/supersedes the prior active session for the same invitation/client fingerprint. Invitation revocation, regeneration, and entitlement deactivation revoke associated active sessions in the database.

Internal session tables and elevated functions are unavailable to `anon` and `authenticated` roles. Service functions use `SECURITY DEFINER`, an empty `search_path`, fully qualified objects, strict input validation, and service-role-only execute grants.

## Consequences

- Revocation takes effect on the next protected request without cookie clearing.
- The database becomes authoritative for browser-session validity.
- Every protected request incurs a server-side lookup and authorization decision.
- Cleanup functions are still needed to mark expired rows, although runtime validation rejects expired sessions even before cleanup.
- A future private route layer may use Hono or another permissive router, but the public core remains framework-neutral.

## Alternatives rejected

- JWT-only learner authorization: insufficient immediate revocation.
- Supabase Auth sessions: introduce accounts/password/OTP/provider assumptions outside the approved experience.
- Redis or external session service: unnecessary operational dependency for the current scale.
- Framework session middleware: binds the public core to a router, middleware lifecycle, and storage driver.
- Cookie-only signed state: cannot independently prove current entitlement and invitation status.

## Provenance

This session model is original MadLogic implementation informed by established server-side session architecture, PostgreSQL security features, and public HTTP cookie standards. AdonisJS Session and other frameworks were evaluated only as architecture references. No upstream session-package, LMS, AGPL, or GPL source code was copied or adapted.
