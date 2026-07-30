# ADR-0008: Transactional outbox boundary

- **Status:** Accepted
- **Context:** Enrollment changes and emitted learning events must not diverge when publication fails.
- **Decision:** Persist domain mutations and outbox records inside one unit-of-work transaction. Publish only after commit and retry from pending outbox records.
- **Consequences:** Consumers receive at-least-once delivery and must deduplicate by event identity. Publication latency is possible.
- **Alternatives considered:** Publish before commit; best-effort callbacks; distributed transactions.
- **Security implications:** Reduces inconsistent authorization and notification state. Outbox payloads must be minimized and free of bearer secrets.
- **Public/private implications:** Public contracts define atomicity; private consumers choose transport and payload mappings.
