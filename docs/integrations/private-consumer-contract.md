# Private consumer integration contract

A private consumer may compose the public packages through configuration and adapters while keeping all production values private.

The public core owns reusable learner, course, course-run, lesson, enrollment, access-link, progress, event, persistence, and runtime contracts. A consumer owns branding, curriculum, tier presentation, purchaser mappings, communication workflows, destinations, credentials, and deployment configuration.

Private extensions must not weaken public security invariants. Divergence should be documented with the reason, affected contract, migration path, and public/private implications.
