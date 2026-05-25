# Security Policy

## Supported Versions

Unless a repository states otherwise, public SamyRai projects are maintained on the default branch and the latest published release.

Pre-1.0 projects receive security fixes on the default branch unless a maintained release branch exists.

## Reporting a Vulnerability

Do not open a public issue for vulnerabilities.

Report suspected vulnerabilities privately by email:
security@glpx.pro

If the target repository has GitHub private vulnerability reporting enabled, you may also use the repository's Security tab to open a private advisory.

Include:

- affected package, version, branch, or commit
- clear description and impact
- reproduction steps or proof of concept
- relevant logs, stack traces, or screenshots with secrets redacted
- suggested fix or mitigation, if available

Expected response:

- initial response within 48 hours
- status update within 7 days
- fix timeline based on severity and scope

## Secrets

- Do not commit API keys, tokens, passwords, private keys, or local config containing credentials.
- Prefer environment variables or untracked local config for credentials.
- Redact credentials in logs, issue reports, pull requests, and screenshots.

