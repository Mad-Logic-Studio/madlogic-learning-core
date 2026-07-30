# ADR-0003: Enrollment is durable; access links are disposable

- **Status:** Accepted
- **Date:** 2026-07-30
- **Issue:** #1

## Context

MadLogic Learning Core needs a small, reusable foundation that can serve multiple private production consumers without coupling the public API to one provider, frontend, brand, or deployment.

## Decision

Model Enrollment as the durable evidence of learner access and status history. Model AccessLink as a separate expiring, revocable, consumable capability whose token is represented only by a hash.

## Consequences

The public API remains portable and reviewable. Some production convenience is deferred until adapter and consumer validation work. Contracts may change while the project is experimental.

## Alternatives considered

- a monolithic application repository
- provider-specific domain objects
- embedding production configuration in the public core
- adopting a full LMS or authentication platform immediately

## Security implications

The decision reduces accidental credential and personal-data exposure. Security-sensitive implementations still require threat modeling, tests, and private configuration.

## Public/private implications

Reusable contracts and design rationale are public. Consumer identity, proprietary content, users, destinations, credentials, and operational values remain private.
