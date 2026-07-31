# Changelog

All notable changes to this project will be documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project intends to use semantic versioning after the public API stabilizes.

## [Unreleased]

### Added

- Initial TypeScript workspace and package boundaries.
- Preliminary learning-domain contracts.
- Governance, security, provenance, architecture, CI, and build-journal foundations.
- Explicit enrollment and access-link transition rules.
- Versioned repository, idempotency, transaction, and outbox contracts.
- Synthetic in-memory persistence fixture and conformance tests.
- One-click access threat model and digest-only token lifecycle architecture.
- Additive PostgreSQL/Supabase migrations for courses, lessons, lesson progress, durable enrollment history, idempotency, and transactional outbox events.
- Supabase classroom row mappings and migration safety tests.
- Consumer-first portable persistence architecture and deployment verification guidance.

### Changed

- Enrollment and access-link aggregates now carry optimistic-concurrency versions.
- Access links use a typed token digest and explicit single-use or reusable policy.
- Test execution now runs all contract suites.
- Existing classroom cohorts and numbered resources can be upgraded in place to course and lesson relationships without replacing established access or purchase workflows.
