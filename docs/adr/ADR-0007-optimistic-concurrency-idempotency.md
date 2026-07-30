# ADR-0007: Optimistic concurrency and idempotency

- **Status:** Accepted
- **Context:** One-click access and enrollment commands may be retried or race across workers.
- **Decision:** Versioned repositories require an expected version. Commands carry idempotency keys, and persistence binds each key to an operation and request hash. Identical replays return prior state; changed requests conflict.
- **Consequences:** Stale writers fail explicitly and safe retries do not duplicate effects. Callers must handle conflict results.
- **Alternatives considered:** Last-write-wins; distributed locks; process-local deduplication.
- **Security implications:** Prevents replay-driven duplicate issuance and stale authorization changes.
- **Public/private implications:** Keys and hashes are generic; private providers choose storage and retention policy.
