module.exports = {
  platform: "gitea",
  endpoint: "https://gitea.bk.glpx.pro/api/v1",

  // If token is missing, Renovate will fall back to using process.env.RENOVATE_TOKEN automatically
  ...(process.env.RENOVATE_TOKEN && { token: process.env.RENOVATE_TOKEN }),

  extends: ["config:recommended", ":configMigration"],

  autodiscover: true,
  // Restrict autodiscover to the actual namespace to avoid touching unrelated repos
  autodiscoverNamespaces: ["mukimovd", "glpx"],

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
      ...(process.env.HARBOR_USERNAME && { username: process.env.HARBOR_USERNAME }),
      ...(process.env.HARBOR_PASSWORD && { password: process.env.HARBOR_PASSWORD }),
      abortOnError: true,
      concurrentRequestLimit: 4,
    },
  ],

  onboardingConfig: {
    extends: ["config:recommended", ":configMigration"],
  },

};
