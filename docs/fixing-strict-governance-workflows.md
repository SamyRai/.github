# Fixing `strict-governance / verify` failures on Renovate PRs

## Symptom

Renovate dependency PRs fail the `strict-governance / verify` job with:

```
error: The lockfile is out of date. Run `deno install --frozen=false`, or
rerun with `--frozen=false` to update it.
```

at the `deno install --frozen` step.

## Root cause

Renovate updated `deno.json` / `package.json` dependency pins but did not
regenerate `deno.lock` on the PR branch (its artifact-update step failed, or
the branch predates the org's lockfile handling). `--frozen` then correctly
refuses to install: the lockfile no longer matches the manifests. This is
NOT a Deno-version compatibility problem — do not pin Deno v1.x in response.

Verified 2026-08-15 on mukimovd/react-inventory CI jobs (e.g. job 44849):
every strict-governance failure in the 2026-08 wave failed at the identical
lockfile check, on repos whose own CI passes on main.

## Fix

On the PR branch:

```sh
deno install --frozen=false   # regenerates deno.lock against the bumped pins
deno task check               # or the repo's typecheck task
git add deno.lock && git commit -m "fix: regenerate deno.lock for bumped deps"
git push
```

CI reruns on the new head. Do not commit a lockfile you have not typechecked.

## Prevention

The org Renovate config owns lockfile artifacts. If another wave of
`renovate/artifacts` commit-status failures appears, read it as "branches
carry stale lockfiles" and repair the branches as above; the config side
(host rules, post-update options) lives in this repository's `config.js` /
`renovate.json`.
