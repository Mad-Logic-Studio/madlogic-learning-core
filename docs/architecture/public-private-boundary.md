# Public/private boundary

## Public reusable core

The public repository may contain provider-neutral domain types, generic database and runtime adapter contracts, security architecture, token-hashing and session-validation designs, synthetic examples, tests, ADRs, provenance records, and build journals.

## Private production consumers

Private repositories retain branding, proprietary curriculum, real learner/customer data, raw access tokens, signing keys, credentials, provider identifiers, private meeting/replay destinations, and operational configuration.

## Decision test

A capability belongs publicly when it is reusable without revealing a consumer's identity, content, users, destinations, or credentials. Consumer-specific mappings and values remain private even when they configure a public interface.

## Review checklist

- synthetic data only
- no real URLs, IDs, tokens, keys, contacts, or learner records
- no proprietary curriculum or media
- provider-neutral core objects
- security designs expose no secrets
- private divergence documented in the consumer repository
