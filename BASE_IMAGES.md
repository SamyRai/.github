# Base image policy

Dockerfiles across `glpx/*` and `mukimovd/*` repos should use **pinned** base
images through Harbor, not floating upstream tags. This keeps pulls observable,
cacheable, and independent of Docker Hub anonymous rate limits.

## Rules

1. **Source Docker Hub through Harbor.** Use
   `registry.bk.glpx.pro/dockerhub-proxy/<upstream-path>:<version>` for new
   Docker Hub bases. Existing curated
   `registry.bk.glpx.pro/library/<image>:<version>` references remain supported.
2. **Always pin.** No `:latest`, no floating `golang:alpine` / `alpine` / `nginx:alpine`.
   Pin `major.minor` (e.g. `golang:1.26-alpine`, `alpine:3.21`). The shared Renovate config
   (`docker:enableMajor`) bumps them via PRs.
3. **Preserve the upstream repository path.** Official images use paths such as
   `dockerhub-proxy/debian`; namespaced images use paths such as
   `dockerhub-proxy/nginxinc/nginx-unprivileged`.
4. **Pin a digest for release-critical builders and runtimes.** Retain the
   human-readable tag and append `@sha256:<digest>`. Renovate can then propose
   deliberate base refreshes without silently changing a rebuild.

## Current fleet targets

| Stack | Build base | Runtime base | Notes |
|---|---|---|---|
| Go | `library/golang:1.26-alpine` | `gcr.io/distroless/static-debian12:nonroot` | Curated historical builder; non-Docker-Hub runtime |
| Rust | `dockerhub-proxy/rust:1.x-bookworm` | `dockerhub-proxy/debian:bookworm-slim` | Pin both |
| Deno | `dockerhub-proxy/denoland/deno:debian-<ver>` | same | Pin (for example `2.9.3`) |
| Flutter web | `dockerhub-proxy/debian:bookworm-slim` + checksum-verified Flutter SDK archive | `dockerhub-proxy/nginxinc/nginx-unprivileged:<ver>-alpine` | Pin image digests and SDK checksum |

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

It fails on floating tags (`:latest`, unpinned
`:alpine`/`:bookworm`/`:slim`) and on known Docker Hub bases used without
either the `registry.bk.glpx.pro/dockerhub-proxy/` or supported curated
`registry.bk.glpx.pro/library/` prefix.
