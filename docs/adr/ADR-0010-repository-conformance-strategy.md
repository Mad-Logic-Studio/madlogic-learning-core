# ADR-0010: Repository conformance-test strategy

- **Status:** Accepted
- **Context:** PostgreSQL and future adapters must preserve the same observable behavior.
- **Decision:** Publish adapter-neutral contracts and reusable conformance exercises. Maintain a synthetic in-memory fixture to prove the contract and transaction model without credentials.
- **Consequences:** Every adapter can be checked for insert/load, missing records, version conflicts, idempotency, and rollback behavior. The fixture is not a performance or SQL fidelity model.
- **Alternatives considered:** Adapter-specific tests only; mocks with no behavioral storage; production-database tests in core CI.
- **Security implications:** Consistent fail-closed behavior can be verified before production integration.
- **Public/private implications:** Synthetic fixtures remain public; production connection details and datasets remain private.
