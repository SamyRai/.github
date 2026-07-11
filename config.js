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
      matchHost: "registry.bk.glpx.pro",
      hostType: "docker",
      ...(process.env.REGISTRY_USERNAME && { username: process.env.REGISTRY_USERNAME }),
      ...(process.env.REGISTRY_PASSWORD && { password: process.env.REGISTRY_PASSWORD }),
      abortOnError: true,
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
