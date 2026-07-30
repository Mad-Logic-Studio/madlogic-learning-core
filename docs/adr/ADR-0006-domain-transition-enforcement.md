# ADR-0006: Domain transition enforcement

- **Status:** Accepted
- **Context:** Durable enrollment and disposable access-link evidence must not be rewritten into impossible states.
- **Decision:** Publish explicit transition tables and pure transition functions. Enrollment history begins with `pending`, remains chronological, and is appended rather than replaced. Terminal states cannot reactivate. Access links transition from `active` to consumed, revoked, or expired; reusable links cannot be consumed.
- **Consequences:** Callers receive deterministic failures and aggregate versions increment on accepted transitions. Future policy changes require reviewed contract changes.
- **Alternatives considered:** Free-form status assignment; database-only constraints; deleting old evidence.
- **Security implications:** Invalid resurrection and silent evidence loss fail closed.
- **Public/private implications:** Rules are generic; private tier names and operational reasons remain consumer-owned.
