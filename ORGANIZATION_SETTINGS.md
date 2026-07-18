# Organization Settings Guide

> [!NOTE]
> **This is a reference checklist, not enforced automation.** Gitea/GitHub org-level
> branch-protection and Actions-settings must be applied in the respective admin UIs. This
> document is the canonical record of the GLPX-recommended configuration. Ported from the
> former `glpx/.github` during the `.github` repo unification (mukimovd/.github is canonical).

Describes the recommended organization-wide settings for Glowing-Pixels-UG (`glpx`) and the
personal `mukimovd` namespace on Gitea (`gitea.bk.glpx.pro`).

## Branch Protection Rules

Configure these rules for the default branch (`main`) in each repository:

### Required Settings

- **Require pull request reviews before merging**
  - Required number of approvals: 1
  - Dismiss stale pull request approvals when new commits are pushed: Yes
  - Require review from Code Owners: Yes

- **Require status checks to pass before merging**
  - Require branches to be up to date before merging: Yes
  - Required checks: the reusable CI workflow(s) the repo calls (e.g. `go-ci`, `deno-ci`)

- **Require conversation resolution before merging**: Yes
- **Do not allow force pushes**: Yes
- **Do not allow deletions**: Yes

> [!WARNING]
> The `mukimovd` namespace is single-operator; strict branch protection there can deadlock
> merges (no second reviewer). Apply these rules to the `glpx` org repos and any multi-contributor `mukimovd` repo. For solo `mukimovd` repos, require status checks only.

## Gitea Actions Settings

- **Enable Actions** on every repo under `glpx/*` and `mukimovd/*`.
- **Secrets strategy**: org (`glpx`) and user (`mukimovd`) level — never per-repo unless the
  repo needs a divergent value (see `.gitea/README.md` § Secrets Strategy).
- **Required secrets** (sourced from Vault, applied in the Gitea UI):
  - `REGISTRY_USERNAME` / `REGISTRY_PASSWORD` — Harbor push robot (per-app project-scoped, provisioned via `glpxctl harbor ensure`)
  - `GITEA_TOKEN` — runner-side Gitea clone/pull (user-level PAT)
  - `NPM_TOKEN` / `GLPX_NPM_TOKEN` — private `@glpx` Gitea npm registry
  - `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` — optional, upstream rate-limit headroom (user-level)

## Security

- **Dependency scanning**: Renovate (`osvVulnerabilityAlerts: true`) — the sole updater. Dependabot is intentionally disabled.
- **Vulnerability PRs**: auto-merge with `security` label on green CI.
- **Secret scanning**: enabled at the Gitea instance level (not per-repo).
- **Image vulnerability gating**: Harbor per-project scan + pull-prevention (see SHIP_PIPELINE).

## General

- **Default branch**: `main`
- **Default repository visibility**: private for `glpx/*` internal repos; public for open-source `mukimovd/*` libraries
- **CODEOWNERS**: this repo's `CODEOWNERS` is the org-wide fallback; repos may override.
- **Community files**: `CODE_OF_CONDUCT.md`, `SECURITY.md`, `CONTRIBUTING.md`, `SUPPORT.md`, and `ISSUE_TEMPLATE/` in this repo are the defaults for repos without their own.

## Gitea org-default-file semantics

Gitea uses the `.github` repo at the org/user root as the source of default community health
files and (for the `profile/README.md`) the org profile page. This is why
`mukimovd/.github` exists. The legacy `glpx/.github` was a drifted copy; it has been mirrored
to match `mukimovd/.github` so both namespaces see the same defaults.
