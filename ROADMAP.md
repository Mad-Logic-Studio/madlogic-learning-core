# Roadmap

No dates are promised. Scope advances only after documented review.

## v0.1 — Foundation

Workspace, governance, package boundaries, initial domain vocabulary, CI, provenance, and safe example composition.

## Core domain and persistence

Status: PostgreSQL/Supabase migrations, existing-classroom compatibility, row mappings, status history, optimistic versions, idempotency, and transactional outbox foundations are implemented through WO-003. Future work should focus on the smallest required real adapter behavior rather than expanding the schema speculatively.

## One-click access

Threat model and digest-only lifecycle contracts are documented. Future work includes secure token generation, hashing adapters, atomic redemption, session rotation, rate limiting, and audit implementation.

## Progress and event tracking

Lesson progress persistence and outbox production are implemented. Future work includes an expected-version server adapter, outbox publishing, cleanup operations, and reporting only as required by a real consumer.

## Administration contracts

Introduce only the course, lesson, run, enrollment, and access administration interfaces required by approved classroom workflows. Do not build a generalized LMS administration suite prematurely.

## Private production-consumer validation

Connect an approved private consumer to the public persistence package without exposing proprietary content, data, links, credentials, or deployment identifiers.

## Community stabilization

Gather implementation feedback, harden compatibility, document supported surfaces, and prepare versioned releases when appropriate.
