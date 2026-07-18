# Base image policy

Dockerfiles across `glpx/*` and `mukimovd/*` repos should use **pinned** base images from
the **curated Harbor mirror**, not floating upstream tags. This keeps the fleet on one set
of vetted bases and dodges Docker Hub anonymous rate limits.

## Rules

1. **Source from the mirror when available.** Use
   `registry.bk.glpx.pro/library/<image>:<version>` for images present in Harbor's curated
   `library` project (today: `golang`, `alpine`, `buildkit`, `temporal-*`, a few migrators).
2. **Always pin.** No `:latest`, no floating `golang:alpine` / `alpine` / `nginx:alpine`.
   Pin `major.minor` (e.g. `golang:1.26-alpine`, `alpine:3.21`). The shared Renovate config
   (`docker:enableMajor`) bumps them via PRs.
3. **Image not in the mirror yet?** Either:
   - push it once (`docker pull <upstream>:<tag>` → `docker tag` →
     `docker push registry.bk.glpx.pro/library/<image>:<tag>`; needs admin/push rights), or
   - pin the upstream tag and pass `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` to the
     `docker-ci` caller so the build authenticates to Docker Hub (higher rate limit).

## Current fleet targets

| Stack | Build base | Runtime base | Notes |
|---|---|---|---|
| Go | `library/golang:1.26-alpine` | `gcr.io/distroless/static-debian12:nonroot` | mirror for golang/alpine |
| Rust | `rust:1.x-bookworm` | `debian:bookworm-slim` | pin upstream until mirrored |
| Deno | `denoland/deno:debian-<ver>` | same | pin upstream (e.g. `2.8.3`) |
| Static/web | — | `nginx:<ver>-alpine` | pin; mirror `alpine` available |

Drift to fix (Epic C): `alpine:latest` (pkg, meta_graph_sdk), `golang:alpine` (go_ast_tool),
`golang:1.23` (fabrika_smm), deno `2.1.4` (ship-game), unpinned `nginx:alpine` (bugulma-home).

## CI enforcement

New drift is blocked at CI by the reusable `base-images-guard.yml` workflow. Wire it into any
repo with a Dockerfile/compose/Helm values:

```yaml
jobs:
  base-images:
    uses: mukimovd/.github/.gitea/workflows/base-images-guard.yml@main
```

It fails on floating tags (`:latest`, unpinned `:alpine`/`:bookworm`/`:slim`) and on
must-mirror images used without the `registry.bk.glpx.pro/library/` prefix. Existing drift
(to fix list above) is exempt until migrated; the guard prevents *new* drift.

## Recommended improvement (platform follow-up)

`library` is a **manually curated** project, not a pull-through cache — new bases need a
manual push. Standing up a Harbor **proxy-cache** registry for `docker.io` (a `dockerhub`
proxy project) would auto-mirror any pinned upstream image on first pull and remove the
manual step entirely. This is the durable fix for both rate limits and consistency.

> [!NOTE]
> **Tracking:** the proxy-cache rollout is owned by the **cluster** repo (Harbor is deployed
> there). Once it lands, the `base-images-guard.yml` "must-mirror" list becomes the allowlist
> of images that should be rewritten to the proxy URL instead of `library/`.
