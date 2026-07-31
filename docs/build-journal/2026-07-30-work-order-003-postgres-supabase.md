# Build Journal — Work Order 003

- **Date:** 2026-07-30
- **Issue:** #5
- **Branch:** `feature/wo-003-postgres-supabase-persistence`
- **Stacked base:** `feature/wo-002-core-persistence-access-threat-model`

## Purpose

Add the first real PostgreSQL/Supabase persistence layer while extending an approved existing classroom database instead of creating a duplicate LMS schema.

## Pre-deployment audit

The approved private target was verified before DDL. The audit covered:

- applied migrations
- classroom tables and row-preservation baselines
- columns, keys, indexes, triggers, functions, and RLS policies
- access and purchase workflows
- Supabase security and performance advisors

The existing design already provided cohorts, entitlements, resources, digest-only invitations, purchase provisioning, reversals, recovery requests, rate limits, and entitlement events.

## Delivered

- additive course and lesson tables
- cohort-to-course mapping
- resource-to-lesson mapping
- lesson progress with forward-only terminal completion
- entitlement and access-invitation versions
- append-only enrollment status evidence
- idempotency records
- transactional outbox events
- learner-facing RLS policies
- explicit deny policies for server-only tables
- Supabase row-to-domain mapping functions
- migration safety and mapping tests
- ADR-0011 and persistence architecture guidance

## Deployment evidence

Two append-only migrations were applied to the verified private consumer:

1. learning persistence and compatibility migration
2. internal-access hardening migration

Existing table counts remained unchanged after deployment. Every existing cohort received a course mapping, every numbered classroom resource received a lesson mapping, and all existing entitlements received pending plus current status evidence.

A rollback-only transactional probe verified:

- lesson progress version increments
- started and completed outbox events
- completed progress cannot move backward
- entitlement versions increment on update
- no test rows or version changes remained after rollback

Generated Supabase TypeScript types include the new tables, relationships, and version columns.

## Security review

- no raw token material was introduced
- new internal tables are unavailable to anonymous and authenticated client roles
- learner-facing tables use explicit RLS policies
- trigger functions use an empty search path where elevated execution is required
- the administrative RLS event-trigger function is no longer executable through client API roles
- post-deployment schema security advisories are clear

An account-level leaked-password-protection warning remains outside the database migration scope and must be addressed in private Auth settings before broad learner launch.

## Performance review

The advisor reports informational unused-index notices, including newly created indexes that have not yet received production traffic. No index was removed during this work order because the database is young and the indexes support expected foreign-key, learner-progress, outbox, and cleanup access paths.

## Public/private boundary review

Public artifacts contain generic migrations, mappings, synthetic tests, and architecture documentation. Private project references, learner records, proprietary course content, secrets, and operational destinations were not committed.

## Provenance

No upstream source code was copied, adapted, or reused. The implementation follows the project's clean-room provenance policy.

## Known limitations

- no outbox worker is implemented
- no cleanup job for expired idempotency records is implemented
- no administrative course or lesson editor is implemented
- generated consumer database types remain private and are not committed publicly
- direct authenticated progress writes still require application-level expected-version predicates
- no speculative multi-tenant, billing, marketplace, or white-label system was added

## Next milestone

Connect the private classroom application to the new course, lesson, enrollment-history, and progress surfaces. Add the smallest required server adapter for expected-version progress updates and outbox publication before expanding classroom features.
