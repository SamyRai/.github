# CI & Auto-Deploy Observability

> [!WARNING]
> **Status: planned — not yet implemented.** This doc is the agreed scope for the CI
> observability gap surfaced by the 2026-07-18 Harbor-cred silent-stall incident. The
> `fail-loud` guard landed in `config.js` (commit `8a400d7`) closes the *detection* hole for
> that one failure mode; this plan closes the *visibility* hole for the whole auto-deploy
> loop. Implementation is owned by the **cluster** repo (Grafana/Prometheus stack lives there
> at `grafana.bk.glpx.pro`); this file is the contract.

## Why

The auto-deploy loop (`docker-ci.yml` → immutable `YYYYMMDDHHMMSS-<sha7>` tag → Renovate
auto-merge on green with `deploy:auto`) is the most load-bearing thing this repo produces.
When it silently stalled on 2026-07-18 (missing Harbor creds → builds 401'd → no new tags →
Renovate had nothing to bump), the only signal was *no new deploys*. There was no dashboard,
no alert, no SLO. The fail-loud guard now catches *that* cause; observability must catch the
next one — whatever it is — within minutes, not days.

## Scope (this repo — what we expose)

This repo can't ship metrics directly (Gitea Actions runners have no metrics endpoint), but
it owns the **contract** for what consumers and operators should expect:

| Signal | Source | Owned by |
|---|---|---|
| Build success/failure rate per workflow | Gitea Actions API (`/repos/{owner}/{repo}/actions/runs`) | cluster scraping job |
| Runner queue depth + executor utilization | act_runner metrics (already exposed) | cluster |
| Renovate PR throughput (open/merged/created per day) | Renovate logs + Gitea PR API | cluster |
| Time since last successful `docker-ci.yml` push | Gitea Actions API, filtered by workflow name | cluster |
| Time since last `deploy:auto`-labelled merge | Gitea PR API | cluster |

## Scope (cluster repo — what consumes it)

The dashboards and alerts land in the cluster repo's monitoring stack (kube-prometheus-stack
+ VictoriaMetrics on Baikonur). See `cluster/docs/runbooks/` for the runbook pattern. The
minimum viable deliverables:

1. **Gitea Actions scraper** — a small exporter (or a scheduled `glpxctl` subcommand) that
   polls the Gitea Actions API for the `mukimovd/*` and `glpx/*` namespaces and emits
   Prometheus metrics: `gitea_workflow_run_total{repo,workflow,status}`,
   `gitea_workflow_run_duration_seconds{...}`, `gitea_runner_queue_depth`.
2. **"Fleet auto-deploy health" dashboard** in Grafana with three panels:
   - Last successful `docker-ci.yml` run per repo (heatmap; red if > 24h for an active repo).
   - Renovate PR age histogram (p50/p90, per namespace).
   - Build failure rate (1h rolling) with the failing workflow highlighted.
3. **Alerts** (route to the existing GLPX alert receiver):
   - `CIeduNoSuccessfulDeploy24h` — any repo with a `Dockerfile` that hasn't produced a new
     image tag in 24h AND has commits on `main` in that window.
   - `CIRenovateStalled` — zero `deploy:auto` merges in 48h during a scheduled Renovate
     window (indicates the bot is wedged, not just idle).
   - `CIBuildFailureSpike` — failure rate > 30% over 1h for any reusable workflow.

## Non-goals

- Per-step log aggregation (Gitea keeps run logs; Operators grep them when paged).
- Distributed tracing of the deploy loop (overkill at this fleet size).
- Anything that requires changes to runner images or the act_runner deployment itself —
  that's a cluster-repo change, tracked there.

## Tracking

Implementation is tracked in the cluster repo's `TODO.md` under the monitoring section. This
file is the contract that implementation must satisfy; update it if the contract changes.
