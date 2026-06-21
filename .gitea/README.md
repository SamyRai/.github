# Gitea Actions & CI Strategy

This directory contains the global reusable workflow templates for Gitea Actions.

## Reusable Workflows

### `npm-publish.yml`
A shared CD workflow for publishing NPM packages to the Gitea registry. It supports `npm`, `yarn`, and `bun` as package managers.

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

## Secrets Strategy

To keep workflows trivial and sidestep `ServiceAccount`-in-job complications, we avoid complex automated secret synchronizers or DinD runners with Vault mounting.

Instead, secrets are managed **globally at the organization (`glpx`) and user (`mukimovd`) level** within the Gitea UI.

- Keys like `GLPX_NPM_TOKEN`, `REGISTRY_USERNAME`, and `REGISTRY_PASSWORD` (or `HARBOR_*`) are set globally for the `mukimovd` user and the `glpx` organization.
- This ensures they automatically propagate and work across all repositories without needing to inject them manually into every new repo.
- The single source of truth for these tokens remains in Vault (e.g., `secret/baikonur/registry/npm-reader`), and they are manually applied to the org/user in Gitea.

## Historical Context & Root Causes

To prevent re-litigating past CI pipeline issues, here is a record of critical pipeline fixes:

### 1. `go-ci` (ThreadSanitizer VMA on arm64 RPi runners)
- **Issue:** `go test -race` aborted on the cluster's arm64 Raspberry Pi runners due to an unsupported VMA range (ThreadSanitizer requires a 48-bit VA kernel, but the Pi runs a 39-bit VA kernel).
- **Resolution:** Modified the reusable `go-ci.yml` workflow to use `runs-on: amd64` and placed the `-race` execution behind an architecture gate. Now, full race coverage runs on `amd64`, while a fallback tests without the race detector on `arm64`, resulting in a green build regardless of runner architecture.

### 2. `frontend-ci` (Deno / NPM install 401s)
- **Issue:** `deno install` (and `npm install`) failed with `401 Unauthorized` when attempting to fetch from the private `@glpx` Gitea registry.
- **Resolution:** Minted a dedicated `read:package` Personal Access Token (PAT), stored it in Vault, and exposed it as the org-wide `GLPX_NPM_TOKEN` secret. This resolved authentication for linting, type-ratcheting, and building the frontend components.
