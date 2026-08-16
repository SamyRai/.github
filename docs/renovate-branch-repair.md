# Repairing stale Renovate PR branches (2026-08 wave)

During the 2026-08-15 campaign, ~190 of ~250 open renovate PRs across the
org were red. They decomposed into a small number of root causes. This
runbook records the diagnosis short-cuts and the repair that worked, so the
next wave does not need re-derivation.

## Failure classes and one-line diagnosis

| Class | Signal | Repair |
| --- | --- | --- |
| Stale `go.sum` | Go CI: `missing go.sum entry for ...` | On the PR branch: `go mod tidy && go build ./... && git commit go.sum` |
| Stale `deno.lock` | `strict-governance` or Deno CI: `The lockfile is out of date` at `deno install --frozen` | `deno install --frozen=false`, typecheck, commit lock (see `fixing-strict-governance-workflows.md`) |
| Branch behind base (FF-only repos) | merge API 405 `The head branch is behind the base branch` | Rebase the PR head onto main and force-push-with-lease; CI must rerun on the exact head |
| Bot status noise | `renovate/artifacts: failure` commit status | Ignore for merge gating: it reflects Renovate's own update attempt, not CI. Never the sole blocker — verify real job contexts are green |
| Shared-workflow regression | Same new failure on every repo at once | Check this repo's reusable workflows first; `go-ci.yml` once ran consumer scripts with `sh`, breaking `set -o pipefail` |

## Merge protocol (fast-forward-only repos)

Most org repos allow only fast-forward-only merges (`Do: "fast-forward-only"`
on `POST /repos/{o}/{r}/pulls/{n}/merge`). A green PR whose branch is behind
must be rebased first; merging one PR makes its siblings behind again, so
merges per repo are inherently sequential. Renovate's own automerge (go
patch/minor, `automergeType: pr`) also consumes green PRs — expect PRs to
disappear without your involvement, and expect a PR whose head equals main
to be unmergeable noise: close it as superseded.

## Operational cautions learned the hard way

- The Gitea commit-status API aggregates the latest status per context per
  SHA. After hand-pushing a fix, the renovate/artifacts status may remain
  from before — judge by the real CI job contexts.
- `tea pulls merge` reports "is it still open?" for already-merged PRs; the
  API is authoritative.
- When repairing many branches from one machine, share one git worktree per
  repository (not per PR): per-PR clones of large repos filled a 460 GB
  disk in minutes.
- Job logs: `GET /repos/{o}/{r}/actions/jobs/{id}/logs` returns plain text;
  older jobs 404 once logs expire. Fetch the failing job id from the commit
  status `target_url` (`.../actions/runs/{run}/jobs/{job}`).
