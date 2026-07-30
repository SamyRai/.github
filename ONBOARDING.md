# Repo Onboarding

> [!NOTE]
> **Goal:** turn "set up CI for a new repo" from a 30-minute task into a copy-paste.

This repo ships ready-to-use consumer CI scaffolds under [`templates/`](./templates). Each is
a drop-in `.gitea/workflows/ci.yml` that calls the canonical reusable workflow for its stack.
Copy the matching one into a new repo, commit, push — CI runs on the next Gitea Actions
trigger with no further wiring.

## Automated onboarding (`glpxctl`)

Most of the manual flow below is now one command in the `glpxctl` CLI (see
[`cluster/docs/glpxctl.md`](https://gitea.bk.glpx.pro/mukimovd/helm/src/branch/main/docs/glpxctl.md)
§ App onboarding primitives). The headline `glpxctl onboard <owner>/<repo>` orchestrates
the whole flow; in the meantime each step has its own primitive:

| Manual step | `glpxctl` equivalent |
|---|---|
| Harbor project + robot + Vault creds | `glpxctl harbor ensure <project> --robot <name> --vault-path baikonur/<project>/harbor --allow-runtime-write` (now verifies the robot landed) |
| Set `REGISTRY_*` / `GLPX_NPM_TOKEN` on the repo | `glpxctl secret set <owner>/<repo> <NAME> --from-vault <path> --allow-runtime-write` |
| Copy the template + substitute `CHANGEME` | `glpxctl ci scaffold <repo-root> --type <stack> --image-name <n> [--npm-token] --apply` |
| Confirm the build landed | `glpxctl harbor tags <project>/<repo>` |
| Bootstrap the first `<stamp>` into the chart | `glpxctl gitops bump-image <app> <stamp> --apply` |
| Pre-push base-image drift check | `glpxctl drift list --root <repo> --paths 'Dockerfile*'` |

`glpxctl onboard <owner>/<repo> --type go-service --image-name <n> --apply` is the target
end-state (full-stack, incl. helm chart + `apps.yaml` insert + `appset generate`); see
`cluster/TODO.md` §26 for status. The manual steps below remain the ground truth and the
reference for what each primitive does.

## Prerequisites (one-time, per repo)

The reusable workflows read secrets from the **org (`glpx`) and user (`mukimovd`) level** in
Gitea — they propagate automatically. A new repo needs nothing provisioned unless it uses a
secret outside that standard set. The standard secrets (sourced from Vault, applied in the
Gitea UI) are:

| Secret | Used by | Vault source |
|---|---|---|
| `NPM_TOKEN` | `deno-ci`, `node-ci`, `npm-publish`, `docker-ci` (build-time) | `secret/baikonur/registry/npm-reader` |
| `REGISTRY_USERNAME` / `REGISTRY_PASSWORD` | `docker-ci`, `compose-ci`, `release` | Harbor robot `robot$renovate-reader` |
| `GITEA_TOKEN` | `docker-ci` (custom checkout), `release` (GoReleaser) | per-repo or user PAT |
| `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` | `docker-ci` (optional, upstream rate-limit headroom) | — |
| `MODULE_READ_TOKEN` | `go-ci`, `go-integration-ci` (optional; only repos importing private `go.glpx.pro/*` modules) | `secret/baikonur/registry/gdk-module-reader` |
| `GO_MODULE_TOKEN` | `docker-ci` (optional; only Dockerfiles that themselves run `go mod download`) | `secret/baikonur/registry/gdk-module-reader` |

The last two are **different credentials for the same goal** and are easy to
confuse: `MODULE_READ_TOKEN` is a `read:repository` token used to clone the
private repos over git, while `GO_MODULE_TOKEN` is a `read:package` token for the
Gitea Go module registry. A repo needs whichever matches how it fetches — the
reusable Go workflows use the former; a Dockerfile doing its own `go mod
download` uses the latter. See § Private Go modules below.

See [`.gitea/README.md`](./.gitea/README.md) § Secrets Strategy for the full rationale.

## Private Go modules (`go.glpx.pro/*`)

The `gdk-*` kits are private Gitea repositories published under the `go.glpx.pro`
vanity path. Two things are needed to consume them, and `go-ci.yml` /
`go-integration-ci.yml` handle both:

1. **`GOPRIVATE=go.glpx.pro/*`** — set in the reusable workflow. Without it, Go
   goes to `proxy.golang.org` and the public checksum database and fails with a
   sum mismatch rather than an obvious "private repository" error.
2. **`MODULE_READ_TOKEN`** — a Gitea token with `read:repository` scope. Discovery
   returns an `ssh://` clone URL, which works for a developer (their key is
   loaded) but not for a runner. The workflow rewrites it to
   token-authenticated https **for CI only**, via
   `git config --global url.<https>.insteadOf <ssh>`, leaving the vanity metadata
   and every developer's SSH workflow untouched.

Pass it through from a caller that needs it:

```yaml
jobs:
  go-ci:
    uses: mukimovd/.github/.gitea/workflows/go-ci.yml@main
    secrets:
      MODULE_READ_TOKEN: ${{ secrets.MODULE_READ_TOKEN }}
```

The secret is **optional**: a repo with no private module dependencies can omit
it, and the step logs a warning and skips rather than configuring a broken
credential. Install it with `glpxctl` rather than by hand so the value comes
from Vault and is never printed:

```bash
glpxctl secret set <owner>/<repo> MODULE_READ_TOKEN \
  --from-vault baikonur/registry/gdk-module-reader --allow-runtime-write
```

Do **not** "fix" a fetch failure by making the vanity server advertise `https://`
instead — that would repair CI by breaking every developer's SSH workflow.

## Pick a template

| Stack | Template | Reusable workflow it calls |
|---|---|---|
| Go (lib/CLI) | [`templates/ci/go.yml`](./templates/ci/go.yml) | `go-ci.yml` |
| Go (integration) | [`templates/ci/go-integration.yml`](./templates/ci/go-integration.yml) | `go-integration-ci.yml` |
| Go service (CI + image) | [`templates/ci/go-service.yml`](./templates/ci/go-service.yml) | `go-ci.yml` + `docker-ci.yml` |
| Deno | [`templates/ci/deno.yml`](./templates/ci/deno.yml) | `deno-ci.yml` |
| Node | [`templates/ci/node.yml`](./templates/ci/node.yml) | `node-ci.yml` |
| Python | [`templates/ci/python.yml`](./templates/ci/python.yml) | `python-ci.yml` |
| Rust | [`templates/ci/rust.yml`](./templates/ci/rust.yml) | `rust-ci.yml` |
| Docker (image only) | [`templates/ci/docker.yml`](./templates/ci/docker.yml) | `docker-ci.yml` |

## Onboarding steps

1. **Create the repo on Gitea** under `mukimovd` or `glpx`. If it should also build/push a
   Docker image, decide its image name now (convention: `<namespace>/<repo>` minus the
   `-private` suffix, e.g. `glpx/kb-server`).
2. **Copy the template** into `.gitea/workflows/ci.yml` in the new repo:
   ```sh
   # from the new repo root
   mkdir -p .gitea/workflows
   cp ~/projects/mukimovd-dotgithub/templates/ci/<stack>.yml .gitea/workflows/ci.yml
   ```
3. **Edit the placeholder values** (search for `CHANGEME`): image name, build context, custom
   test command, etc. Each template flags them in a comment.
4. **(If Docker)** add a `base-images-guard.yml` job to block base-image drift, and confirm
   the repo's Dockerfile pins from `registry.bk.glpx.pro/library/` per [`BASE_IMAGES.md`](./BASE_IMAGES.md).
5. **Commit and push to `main`.** The reusable workflow runs on the next `push`/`pull_request`
   trigger. The first run will surface any missing-secret issues loudly (the workflows
   fail-closed on required secrets).
6. **(Optional) Opt into Renovate auto-deploy.** Add the `deploy:auto` label convention by
   extending this repo's `renovate.json` preset from the new repo's own `renovate.json`:
   ```json
   { "extends": ["local>mukimovd/.github"] }
   ```
   See [`renovate.json`](./renovate.json) for the auto-merge rules this inherits.

## Verify it landed

After the first green run on `main`:

- The repo appears in Gitea Actions with a passing `CI` run.
- (If Docker) `registry.bk.glpx.pro/<image>:<timestamp>-<sha7>` exists in Harbor, and a
  Renovate PR bumping the GitOps values tag opens within the next scheduled window (4x/day,
  off-peak Europe/Berlin).

## Troubleshooting

- **`authentication required: Repository not found` at job start** — you referenced a
  composite action cross-repo. Don't. See [`.gitea/actions/README.md`](./.gitea/actions/README.md).
- **`401 Unauthorized` pulling `@glpx` npm packages** — `NPM_TOKEN` is unset/empty at the
  org/user level. Re-apply from Vault (`secret/baikonur/registry/npm-reader`).
- **`412 Precondition Failed` pushing an image tag** — Harbor tag-immutability trips when a
  build pushes a second tag at the same manifest. The canonical `docker-ci.yml` pushes exactly
  one immutable tag; if you hit this you're on a custom lane. Switch to `docker-ci.yml`.
- **`go test -race` aborts on arm64** — expected on the RPi runners (39-bit VMA). `go-ci.yml`
  already gates `-race` on `GOARCH==amd64`; if you hit this you've forked the race step.
- **`fatal: Could not read from remote repository` fetching a `go.glpx.pro/*` module** —
  `MODULE_READ_TOKEN` is unset. The kits are private, and `go.glpx.pro` discovery returns an
  `ssh://` clone URL: correct for a developer whose key is loaded, impossible for a runner.
  `go-ci.yml` rewrites it to token-authenticated https, but only when the secret exists.
  See § Private Go modules above.
