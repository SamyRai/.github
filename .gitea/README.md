# Gitea Actions & CI Strategy

This directory contains the global reusable workflow templates for Gitea Actions.

## Reusable Workflows

> [!IMPORTANT]
> **Renovate is the sole dependency updater** for this fleet. Dependabot is intentionally
> not used (it was retired in favor of Renovate's registry-aware automerge loop). Do not add
> a `dependabot.yml` to consumer repos.

### Stack CI workflows (one per language)

| Workflow | Stack | Notes |
|---|---|---|
| `go-ci.yml` | Go (lib/CLI) | Format, module verification, build, race tests, vet, Staticcheck, govulncheck, gosec, and tidy drift. Tool/action revisions are pinned; `-race` is gated on amd64. |
| `go-integration-ci.yml` | Go + Postgres | Applies the same pinned quality/security contract as `go-ci`, then runs integration tests against `postgres:18-alpine`. |
| `deno-ci.yml` | Deno | `deno ci`, fmt, lint, task check, task test. Optional `@glpx` npm auth. |
| `node-ci.yml` | Node | Locked Yarn (via a pinned Corepack launcher) or `npm ci`; installs fail closed. Optional `@glpx` npm auth. |
| `bun-ci.yml` | Bun | install, lint, typecheck, test. |
| `python-ci.yml` | Python | uv + ruff + pytest. **Restricted to `<3.14`** (see below). |
| `rust-ci.yml` | Rust | fmt, clippy `-D warnings`, workspace test. |
| `ruby-ci.yml` | Ruby | rubocop + rspec/rails test (fail-loud). |
| `hugo-ci.yml` | Hugo | extended build with `--gc --minify`, submodules. |
| `flutter-ci.yml` | Flutter | SDK from `.fvmrc`, optional private-Pub and private-Git authentication, enforced lockfile, strict analysis, tests, optional web build. |

### Build / deploy workflows

| Workflow | Purpose |
|---|---|
| `docker-ci.yml` | **Canonical** Docker build/push. Pushes one immutable `YYYYMMDDHHMMSS-<sha7>` tag with BuildKit SPDX SBOM attestation and emits tag, digest, image-reference, and OCI SBOM-subject outputs; Renovate auto-bumps tag-managed GitOps values on green. |
| `compose-ci.yml` | Bring up a compose stack, run e2e/integration, tear down. Two models: `exit-from` or `test-command`. |
| `deno-compile.yml` | Cross-compile Deno binaries (5 targets). |
| `deno-publish-jsr.yml` | Publish to JSR via `deno publish` (OIDC). |
| `npm-publish.yml` | Publish `@glpx` scoped packages to the Gitea npm registry (npm/yarn/bun). |
| `dart-publish.yml` | Publish one workspace package to the Gitea pub registry. Tag-gated, fails closed on tag/version/`publish_to`/branch-ancestry mismatch; optional promotion policy, verify gates, OSV scan, and hosted-install proof. |
| `release.yml` | GoReleaser release (with UPX). |
| `base-images-guard.yml` | Enforces `BASE_IMAGES.md` policy (no floating tags, must-mirror list). |
| `security-sweep.yml` | gosec over Go code. |

### Catalog workflows (this repo only)

| Workflow | Purpose |
|---|---|
| `actionlint.yml` | Lints `.gitea/workflows/*.yml`. |
| `renovate-runner.yaml` | The global Renovate bot (4x/day off-peak + push + dispatch). |

## Consumer scaffolds

New repos should copy a template from [`../templates/ci/`](../templates/ci/) rather than
hand-write a `uses:` reference. See [`../ONBOARDING.md`](../ONBOARDING.md).

### `npm-publish.yml`
A shared CD workflow for publishing NPM packages to the Gitea registry. It supports `npm`, `yarn`, and `bun` as package managers. Every manager uses its frozen/immutable install mode; Yarn consumers must pin the manager in `package.json#packageManager`.

### Deno v2 Workflows
- **`deno-ci.yml`**: A standard CI workflow that runs `deno install`, `deno fmt`, `deno lint`, `deno check`, and `deno test`. Supports injecting `NPM_TOKEN` for projects relying on your private `@glpx` registry.
- **`deno-compile.yml`**: Compiles the Deno application into standalone binaries across a matrix of Linux, macOS, and Windows architectures, and uploads them as artifacts.
- **`deno-publish-jsr.yml`**: Publishes Deno v2 modules directly to the public JavaScript Registry (JSR) using `deno publish`.

**Usage Example (Deno Compile):**
```yaml
jobs:
  compile:
    uses: mukimovd/dot-github/.gitea/workflows/deno-compile.yml@main
    with:
      entrypoint: 'main.ts'
      binary-name: 'my-app'
```

### Flutter / Dart Workflows
- **`flutter-ci.yml`**: The quality gate. SDK from `.fvmrc`, optional private-Pub
  and read-only private-Git authentication, `flutter pub get --enforce-lockfile`, strict
  analysis, tests, optional web build. Scaffold:
  [`../templates/ci/flutter-web.yml`](../templates/ci/flutter-web.yml).
- **`dart-publish.yml`**: The release lane. Publishes ONE package from a workspace to the
  private Gitea pub registry (`https://gitea.bk.glpx.pro/api/packages/glpx/pub/`). Scaffold:
  [`../templates/ci/flutter-package.yml`](../templates/ci/flutter-package.yml).

**Credential contract:** `PUB_TOKEN` is deliberately repository-scoped for
private Pub. A package-source repository calling `dart-publish.yml` receives a
dedicated publish PAT with the package permissions required by that workflow. A
repository calling `flutter-ci.yml` only to consume hosted packages receives a
different `read:package` PAT. Developer machines use their own named local
reader. Never install the publisher credential at organization/user scope or
reuse it for a consumer or workstation. First publish of a new package name
works without ceremony (no pub.dev "manual first publish" gate).

Flutter consumers with private Git dependencies may additionally forward
`GIT_READ_TOKEN`, backed by a least-privilege `read:repository` PAT. It is scoped to the
locked install step through a temporary credential file and is removed before analysis,
tests, custom verification, or builds run.

`dart-publish.yml` treats a tag as a release *request*, not a release. It fails closed unless
the tag parses as `<package>-v<version>`, the package exists under `packages-directory`, its
pubspec `publish_to:` equals `registry-url`, the pubspec version equals the tag version, and
the tagged commit is an ancestor of the reviewed default branch. Four further gates are
opt-in: `verify-commands` (the repo's own workspace gates), `promotion-policy-file` (a
reviewed JSON publication decision), `osv-scan` (checksum-pinned osv-scanner, on by default),
and `hosted-install-command` (post-publish proof that a clean consumer can resolve the new
version — a green upload alone does not prove installability).

Authentication uses `dart pub token add --env-var PUB_TOKEN`, which stores the variable
*name* rather than the value, so the token never reaches argv or the on-disk pub config.
Publishing uses `--force` only to suppress the interactive prompt that CI cannot answer; the
preceding `--dry-run` is the real gate and fails on the same warnings.

> [!NOTE]
> This workflow was extracted from the pipeline that has been publishing
> `glpx_flutter_connectivity` out of `flutter-dev-kit`. Repo-specific gates became inputs so
> a second publisher can adopt it without inheriting dev-kit's `tool/` layout.

**Usage Example (Publish, tag-triggered):**
```yaml
on:
  push:
    tags: ['glpx_*-v*']   # e.g. glpx_flutter_connectivity-v0.2.3

jobs:
  publish:
    uses: mukimovd/.github/.gitea/workflows/dart-publish.yml@main
    with:
      packages-directory: packages
      verify-commands: |
        dart run tool/tasks.dart verify
      promotion-policy-file: tool/policy/package_promotion.json
    secrets:
      PUB_TOKEN: ${{ secrets.PUB_TOKEN }}
```

### Private Pub resolution evidence

The reusable Flutter lane has one authenticated boundary:

1. authenticate to the configured hosted registry;
2. run `flutter pub get --enforce-lockfile` with the private-Pub and optional
   private-Git readers available;
3. run custom verification, analysis, tests, and web builds against the
   installed package configuration without resolving again (`--no-pub`).

A cold-cache proof must be online and start with an empty disposable
`PUB_CACHE`; it demonstrates that the hosted artifact and per-repository
consumer credential work. `flutter pub get --offline` is only a second,
warmed-cache proof. It cannot fetch an absent artifact, so its failure does not
diagnose authentication.

Private hosted Pub and private Git are separate trust boundaries. `PUB_TOKEN`
must carry only the package capability required by the repository;
`GIT_READ_TOKEN` carries `read:repository` for commit-pinned Git sources. Keep
both confined to the install step, and require custom `verify-command` values
to skip dependency resolution.

## Python Version Restrictions

**Note on Python:** Python is intentionally restricted to `3.13` and must not be bumped to `3.14+`. This is enforced in the root `renovate.json` configuration via `allowedVersions: "<3.14"` to prevent automated dependency updates from upgrading the Python version constraint across workflows.

## Secrets Strategy

To keep workflows trivial and sidestep `ServiceAccount`-in-job complications, we avoid complex automated secret synchronizers or DinD runners with Vault mounting.

Instead, broadly shared infrastructure readers are managed **globally at the
organization (`glpx`) and user (`mukimovd`) level** within the Gitea UI. A
credential whose permission depends on the repository remains repository
scoped.

- Keys like `GLPX_NPM_TOKEN` may be set globally when their role is genuinely
  identical across consumers. Harbor push credentials remain project-scoped.
- `PUB_TOKEN` is a per-repository exception: publishers and consumers receive
  different tokens and scopes. A repository with no hosted Pub dependency gets
  no Pub credential.
- The single source of truth for managed credentials remains Vault. Reconcile
  the package roles through `glpxctl gitea package-bot`; do not copy values
  between repository, organization, or developer stores.

## Historical Context & Root Causes

To prevent re-litigating past CI pipeline issues, here is a record of critical pipeline fixes:

### 1. `go-ci` (ThreadSanitizer VMA on arm64 RPi runners)
- **Issue:** `go test -race` aborted on the cluster's arm64 Raspberry Pi runners due to an unsupported VMA range (ThreadSanitizer requires a 48-bit VA kernel, but the Pi runs a 39-bit VA kernel).
- **Resolution:** The reusable `go-ci.yml` workflow uses the canonical generic runner label and places `-race` behind a runtime architecture gate. Full race coverage runs on `amd64`; an `arm64` fallback runs the same tests without ThreadSanitizer.

### 2. `frontend-ci` (Deno / NPM install 401s)
- **Issue:** `deno install` (and `npm install`) failed with `401 Unauthorized` when attempting to fetch from the private `@glpx` Gitea registry.
- **Resolution:** Minted a dedicated `read:package` Personal Access Token (PAT), stored it in Vault, and exposed it as the org-wide `GLPX_NPM_TOKEN` secret. This resolved authentication for linting, type-ratcheting, and building the frontend components.
