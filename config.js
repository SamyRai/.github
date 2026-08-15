// Fail-CLOSED guard: the Harbor hostRule below degrades SILENTLY to anonymous
// when REGISTRY_USERNAME/PASSWORD are unset (conditional spread), which makes
// every private registry.bk.glpx.pro image return `no-result` and silently
// stalls the whole fleet's auto-deploy (root cause of the 2026-07-18 incident).
// A console.warn here was the original guard — it failed quietly for 9 days
// (nobody reads Actions logs proactively) and the stall presented as
// "Renovate has 0 open PRs". So: THROW. A credential misconfiguration must
// fail the run loudly, not look green while every private image goes unbumped.
//
// Cred: robot$renovate-reader, Vault secret/baikonur/harbor/robots/renovate-reader
// (fields robot_name, secret). Stored as the Gitea Actions secrets
// REGISTRY_USERNAME / REGISTRY_PASSWORD on THIS repo (mukimovd/.github).
if (!process.env.REGISTRY_USERNAME || !process.env.REGISTRY_PASSWORD) {
  throw new Error(
    "[renovate] FATAL: REGISTRY_USERNAME/REGISTRY_PASSWORD unset — refusing to " +
      "run. Without them the Harbor (registry.bk.glpx.pro) hostRule is anonymous " +
      "and every private image returns no-result, silently stalling fleet " +
      "auto-deploy. Set Gitea Actions secrets REGISTRY_USERNAME/REGISTRY_PASSWORD " +
      "to robot$renovate-reader (Vault secret/baikonur/harbor/robots/renovate-reader).",
  );
}

module.exports = {
  platform: "gitea",
  endpoint: "https://gitea.bk.glpx.pro/api/v1",

  // If token is missing, Renovate will fall back to using process.env.RENOVATE_TOKEN automatically
  ...(process.env.RENOVATE_TOKEN && { token: process.env.RENOVATE_TOKEN }),

  extends: ["config:recommended", ":configMigration"],

  autodiscover: true,
  // Restrict autodiscover to our own repos. NOTE: autodiscoverNamespaces resolves
  // each entry via Gitea's ORG endpoint (/api/v1/orgs/{name}/repos), which 404s on
  // personal users like `mukimovd` ("GetOrgByName: user redirect does not exist").
  // autodiscoverFilter uses /api/v1/repos/search and works for users AND orgs.
  autodiscoverFilter: ["mukimovd/*", "glpx/*"],

  onboarding: false,
  requireConfig: "optional",

  optimizeForDisabled: true,
  timezone: "Europe/Berlin",

  dependencyDashboard: true,
  internalChecksFilter: "strict",
  prCreation: "not-pending",

  // From our previous fix: set to 0 to unblock stale branch pruning
  prConcurrentLimit: 0,
  branchConcurrentLimit: 0,
  pruneStaleBranches: true,

  semanticCommits: "enabled",
  labels: ["dependencies", "renovate"],
  reviewersFromCodeOwners: true,

  repositoryCache: "enabled",

  // Conditionally add redisUrl only if the environment variable is set
  ...(process.env.RENOVATE_REDIS_URL && { redisUrl: process.env.RENOVATE_REDIS_URL }),

  hostRules: [
    {
      // Harbor (registry.bk.glpx.pro) — image-tag source for the whole fleet's
      // GitOps repo (mukimovd/helm, ~470 deps across all apps). Read-only:
      // robot$renovate-reader has pull + list (repo + tag) scope on every project.
      matchHost: "registry.bk.glpx.pro",
      hostType: "docker",
      ...(process.env.REGISTRY_USERNAME && { username: process.env.REGISTRY_USERNAME }),
      ...(process.env.REGISTRY_PASSWORD && { password: process.env.REGISTRY_PASSWORD }),
      // NO abortOnError here, deliberately. With abortOnError:true a SINGLE
      // per-image HTTP error aborts the ENTIRE mukimovd/helm repo, so every app
      // — including clean ones like tercul/backend — silently stops getting
      // image bumps, and the run stays green (per-repo abort, not a run failure).
      // This was the root cause of the 2026-07 fleet-wide no-auto-deploy stall:
      // first agent/go-agent's vulnerable manifests returned 412
      // PROJECTPOLICYVIOLATION (Harbor's "prevent High+ vulns" policy —
      // goharbor/harbor#19408/#15885), then after a [412]-only ignore was added,
      // a non-existent glpx/runner-ubuntu-latest:latest returned 404 — each one
      // aborted the repo and re-stalled the whole fleet. A read-only lookup over
      // hundreds of images will always have some per-image failures; they must
      // NOT block the rest. Default behavior (abortOnError:false) isolates a
      // per-dep error to a soft "no-result" for that one dependency while the
      // other deps (tercul/backend, kb-server, …) process normally. Genuine
      // fleet-wide registry outages surface via the run logs / dashboard anyway.
      // See dev_kb glpx-devops/references/harbor.md → "Harbor 412 + Renovate
      // abortOnError". Do NOT re-add abortOnError here without a tested plan
      // for every status code a multi-image repo can return.
      concurrentRequestLimit: 4,
    },
    {
      // Auth for the private @glpx npm registry so Renovate can look up
      // @glpx/* package updates (e.g. @glpx/ui-kit).
      matchHost: "gitea.bk.glpx.pro",
      hostType: "npm",
      ...(process.env.RENOVATE_TOKEN && { token: process.env.RENOVATE_TOKEN }),
    },
    {
      // Auth for the private go.glpx.pro/* Go modules (the gdk-* kits), which
      // live in private Gitea repos. Deliberately has NO hostType, unlike the
      // npm rule above: a rule with both matchHost AND hostType only matches
      // that type, and the private Go modules need TWO different request paths
      // to be authenticated:
      //
      //   1. Version lookup. go.glpx.pro discovery returns an ssh:// clone URL,
      //      which Renovate resolves through the `git-tags` datasource — so the
      //      rule has to match hostType "git-tags", not "npm" or "go".
      //   2. `go mod tidy` (postUpdateOptions.gomodTidy in renovate.json). The
      //      gomod manager turns credential-bearing hostRules into git
      //      `insteadOf` env directives, but only for rules with no hostType,
      //      hostType "go", or a platform hostType.
      //
      // Before this rule existed, the lookup ran anonymous against a private
      // repo and the dependency dashboard reported "Failed to look up go
      // package go.glpx.pro/gdk-httpclient: no-result". gomodTidy then failed to
      // resolve that module and left go.sum untouched, so every Renovate PR in
      // a kit that imports a sibling failed CI on a *public* module's "missing
      // go.sum entry" — a misleading symptom of this one missing credential.
      //
      // A host-only matchHost IS sufficient, despite the ssh:// clone URLs
      // carrying port 2222. Renovate derives its git `insteadOf` directive from
      // matchHost and therefore emits it without a port, which looks like it
      // would fail to match — but git resolves insteadOf structurally, not by
      // naive string prefix, so `ssh://git@gitea.bk.glpx.pro/` does rewrite
      // `ssh://git@gitea.bk.glpx.pro:2222/...`. Verified 2026-07-30 with
      // `git ls-remote` under GIT_CONFIG_KEY_0/VALUE_0 both with and without the
      // port: both fetch. Do NOT add hand-rolled GIT_CONFIG_* entries to
      // customEnvVariables to "fix" the port — they are unnecessary, and
      // customEnvVariables overrides Renovate's generated git env, so doing so
      // means owning the entire set for every host.
      matchHost: "gitea.bk.glpx.pro",
      ...(process.env.RENOVATE_TOKEN && { token: process.env.RENOVATE_TOKEN }),
    },
    {
      // Public npm registry - increase concurrency for better performance
      matchHost: "registry.npmjs.org",
      hostType: "npm",
      concurrentRequestLimit: 10,
      timeout: 60000,
    },
    {
      // Yarn registry configuration - handle Yarn Classic and Berry compatibility
      matchHost: "yarnpkg.com",
      hostType: "npm",
      concurrentRequestLimit: 5,
      timeout: 60000,
    },
  ],

  // Go env for the private module namespace, mirroring what the reusable
  // go-ci.yml already sets for CI. The gomod manager forwards exactly GOPROXY,
  // GOPRIVATE, GONOPROXY, GONOSUMDB, GOSUMDB and GOINSECURE into the
  // `go mod tidy` child process, so these are the levers available here.
  //
  // Without them, `go mod tidy` consults proxy.golang.org and the public
  // checksum database for go.glpx.pro/* and fails with a confusing sum
  // mismatch rather than an obvious "private repository" error.
  customEnvVariables: {
    GOPRIVATE: "go.glpx.pro/*",
    GONOSUMDB: "go.glpx.pro/*",
    GONOPROXY: "go.glpx.pro/*",
  },

  onboardingConfig: {
    extends: ["config:recommended", ":configMigration"],
  },

};
