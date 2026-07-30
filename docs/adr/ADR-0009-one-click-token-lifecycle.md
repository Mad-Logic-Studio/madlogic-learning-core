# ADR-0009: One-click token lifecycle and digest-only storage

- **Status:** Accepted
- **Context:** Access links are bearer credentials delivered through untrusted channels.
- **Decision:** Raw candidates exist only at issuance and verification boundaries. Persistence stores a versioned digest, expiry, usage policy, status, and audit timestamps. Verification requires constant-time comparison. Single-use consumption and session creation must be atomic.
- **Consequences:** Lost raw tokens cannot be recovered and must be reissued. Runtime adapters must provide secure entropy and cryptographic primitives.
- **Alternatives considered:** Storing plaintext tokens; reversible encryption; permanent reusable links by default.
- **Security implications:** Limits database-disclosure impact and supports expiry, revocation, replay resistance, and algorithm rotation.
- **Public/private implications:** Security architecture is public; keys, URLs, sessions, and production policies remain private.
