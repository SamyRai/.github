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
      // GitOps repo (mukimovd/helm). Read-only: robot$renovate-reader has pull
      // + list (repo + tag) scope on every project.
      matchHost: "registry.bk.glpx.pro",
      hostType: "docker",
      ...(process.env.REGISTRY_USERNAME && { username: process.env.REGISTRY_USERNAME }),
      ...(process.env.REGISTRY_PASSWORD && { password: process.env.REGISTRY_PASSWORD }),
      // Keep abortOnError so genuine registry outages (5xx, auth, network) still
      // surface loudly — BUT tolerate HTTP 412. Harbor's deployment-security
      // policy ("Prevent images with vulnerability severity High+ from running")
      // returns 412 PROJECTPOLICYVIOLATION when Renovate fetches the manifest of
      // a vulnerable image. Without this ignore, a SINGLE vulnerable image
      // anywhere in mukimovd/helm aborts the ENTIRE repo (abortOnError), so every
      // app — including clean ones like tercul/backend — silently stops getting
      // image bumps. This was the root cause of the 2026-07 fleet-wide
      // no-auto-deploy stall (tercul backend pinned 9 days behind main).
      // 412 is per-image; tolerating it makes that one lookup a soft "no-result"
      // while the rest of the repo processes normally. Harbor tracking issues:
      // goharbor/harbor#19408, #15885 (policy middleware fires on manifest HEAD/GET).
      abortOnError: true,
      abortIgnoreStatusCodes: [412],
      concurrentRequestLimit: 4,
    },
    {
      // Auth for the private @glpx npm registry so Renovate can look up
      // @glpx/* package updates (e.g. @glpx/ui-kit).
      matchHost: "gitea.bk.glpx.pro",
      hostType: "npm",
      ...(process.env.RENOVATE_TOKEN && { token: process.env.RENOVATE_TOKEN }),
    },
  ],

  onboardingConfig: {
    extends: ["config:recommended", ":configMigration"],
  },

};
