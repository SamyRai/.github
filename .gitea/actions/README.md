# Composite Actions

## ⚠️ Cross-repo composites do NOT work in this fleet

Step-level `uses: mukimovd/.github/.gitea/actions/<name>@main` **resolves against github.com**
on the act_runner, not against `gitea.bk.glpx.pro`. This repo only exists on Gitea, so every
job that referenced a cross-repo composite failed at the pre-clone step with
`authentication required: Repository not found` — before any guard could evaluate.

This was diagnosed and fixed in commit `11c5c3c` (`fix(ci): inline glpx npm auth step; drop
cross-repo composite action`), which deleted `.gitea/actions/setup-glpx-npm/action.yml` and
inlined its body into `deno-ci.yml`, `node-ci.yml`, and `deno-publish-jsr.yml`.

**Only job-level reusable workflows** (`.gitea/workflows/*.yml` referenced via
`uses: mukimovd/.github/.gitea/workflows/<name>@main`) resolve against the Gitea instance.

## What lives here

`setup-postgres/action.yml` is the only composite. It works **only because it is consumed
intra-repo** (it is referenced from jobs that run *within* repos that vendor or template it
in) — it cannot be consumed cross-repo via `uses:`. If you need a Postgres service in CI,
prefer the `services:` block (see `go-integration-ci.yml`) or `compose-ci.yml` over this.

## Snippets to paste (do NOT make these into composites)

These two snippets are copy-pasted into consumer workflows rather than referenced as
composites. Recreating them as composites would reintroduce the bug above. Keep them in sync
across the workflows that inline them (currently: `deno-ci.yml`, `node-ci.yml`,
`deno-publish-jsr.yml`, `docker-ci.yml`, `release.yml`, `compose-ci.yml`).

### `@glpx` npm auth (inline step)

```yaml
- name: Setup @glpx npm auth
  if: ${{ secrets.NPM_TOKEN != '' }}
  shell: bash
  run: |
    printf '//gitea.bk.glpx.pro/api/packages/glpx/npm/:_authToken=%s\n' \
      "${{ secrets.NPM_TOKEN }}" >> "$HOME/.npmrc"
    printf '@glpx:registry=https://gitea.bk.glpx.pro/api/packages/glpx/npm/\n' \
      >> "$HOME/.npmrc"
```

### Harbor login (inline step)

```yaml
- name: Login to Harbor
  env:
    REGISTRY_USERNAME: ${{ secrets.REGISTRY_USERNAME }}
    REGISTRY_PASSWORD: ${{ secrets.REGISTRY_PASSWORD }}
  run: echo "${REGISTRY_PASSWORD}" | docker login registry.bk.glpx.pro --username "${REGISTRY_USERNAME}" --password-stdin
```

## If we ever want real cross-repo composites

The blocker is act_runner resolving step-level `uses:` against github.com. Options, in
increasing order of effort:

1. **Vendor the action into each consumer repo** (e.g. `.github/actions/setup-glpx-npm/`) —
   works today, but drifts across repos.
2. **Mirror this repo to github.com** and consume the composite from there — the repo is
   already mirrored to `SamyRai/.github`, but the path layout differs (`.gitea/` vs `.github/`)
   so this needs a redirect shim.
3. **Patch act_runner** to resolve step-level `uses:` against the configured Gitea instance —
   the correct fix, but upstream.

Until one of those lands, **inline the snippet**. Do not add new composites under
`.gitea/actions/`.
