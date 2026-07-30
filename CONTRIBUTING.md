# Contributing

MadLogic Learning Core uses issue-first, documented development.

## Required workflow

1. Open or link a GitHub issue before coding.
2. Use a descriptive branch such as `feature/issue-number-purpose`.
3. Reference the issue in every commit.
4. Add or update tests.
5. Record architectural decisions in an ADR.
6. Update the build journal at major milestones.
7. Complete provenance and public/private boundary reviews.
8. Open a pull request before merge.

Commit messages must describe intent, for example `feat(domain): add course-run contract (#123)`. Avoid vague messages.

## Quality requirements

Run `npm run verify`. Pull requests must describe tests, security implications, provenance, and public/private data handling.

## Provenance

Do not copy third-party source without file-level license and provenance review. AGPL projects are architecture and UX references only unless a later legal decision authorizes reuse. Record repository, license, reviewed version or commit, concepts studied, reuse status, and attribution obligations.

## Public data restrictions

Never commit real learner/customer data, raw tokens, signing keys, credentials, proprietary curriculum, private meeting/replay links, MailerLite or Trafft identifiers, or production configuration. Use synthetic examples only.

## Security reporting

Do not disclose vulnerabilities, secrets, or learner data in public issues. Follow [SECURITY.md](SECURITY.md).
