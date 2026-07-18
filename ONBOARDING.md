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

See [`.gitea/README.md`](./.gitea/README.md) § Secrets Strategy for the full rationale.

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
