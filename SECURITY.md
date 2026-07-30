# Security Policy

## Supported versions

MadLogic Learning Core is experimental and has no supported production release yet. Security fixes are applied to the current development line only.

## Reporting a vulnerability

Use GitHub private vulnerability reporting when available, or contact the repository owner privately through GitHub. Do not open a public issue containing exploit details, credentials, raw tokens, learner/customer data, or private operational information.

## Security principles

- raw access tokens must never be stored or logged; persist only cryptographic hashes
- signing keys and credentials remain outside this repository
- production configuration belongs in private deployment systems
- access links are revocable, expiring capabilities separate from durable enrollments
- examples use synthetic data and placeholders
- logs must minimize personal data and credential material

This repository does not currently implement production token issuance or authentication.
