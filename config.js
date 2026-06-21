module.exports = {
  platform: "gitea",
  endpoint: "https://gitea.bk.glpx.pro/api/v1",

  // Do not bake tokens into config, use env var
  token: process.env.RENOVATE_TOKEN,

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
  redisUrl: process.env.RENOVATE_REDIS_URL,

  hostRules: [
    {
      matchHost: "registry.bk.glpx.pro",
      hostType: "docker",
      username: process.env.HARBOR_USERNAME,
      password: process.env.HARBOR_PASSWORD,
      abortOnError: true,
      concurrentRequestLimit: 4,
    },
  ],

  onboardingConfig: {
    extends: ["config:recommended", ":configMigration"],
  },

  force: {
    labels: ["dependencies", "renovate"],
    semanticCommits: "enabled",
    reviewersFromCodeOwners: true,

    // Use OSV since normal vulnerabilityAlerts is GitHub-first
    osvVulnerabilityAlerts: true,

    extends: [
      "helpers:pinGitHubActionDigests",
      ":combinePatchMinorReleases",
      ":semanticCommits",
      ":separateMultipleMajorReleases",
    ],

    kubernetes: {
      fileMatch: [
        "/(^|/)(k8s|kubernetes|manifests|deploy|deployments|clusters|apps)/.+\\.ya?ml$/",
      ],
    },

    helmv3: {
      fileMatch: ["/(^|/)Chart\\.ya?ml$/"],
    },

    "helm-values": {
      fileMatch: [
        "/(^|/)values\\.ya?ml$/",
        "/(^|/)values[-.][^/]+\\.ya?ml$/",
      ],
    },

    lockFileMaintenance: {
      enabled: true,
      schedule: ["* 2-6 * * 1"],
      automerge: false,
    },

    packageRules: [
      {
        description: "Delay public package updates for stability",
        matchDatasources: ["npm", "pypi", "go", "maven", "nuget", "rubygems", "crate"],
        minimumReleaseAge: "7 days",
      },
      {
        description: "Automerge low-risk Go patch/minor updates",
        matchManagers: ["gomod"],
        matchUpdateTypes: ["patch", "minor"],
        postUpdateOptions: ["gomodTidy"],
        groupName: "go non-major dependencies",
        groupSlug: "go-non-major",
        automerge: true,
        automergeType: "pr",
        platformAutomerge: false,
        addLabels: ["lang:go"],
      },
      {
        description: "Group Docker patch/minor updates",
        matchManagers: ["dockerfile", "docker-compose", "helm-values", "kubernetes"],
        matchDatasources: ["docker"],
        matchUpdateTypes: ["patch", "minor", "digest"],
        groupName: "container image updates",
        groupSlug: "container-images",
        automerge: false,
        addLabels: ["stack:docker"],
      },
      {
        description: "Label Helm and Kubernetes updates",
        matchManagers: ["helmv3", "helm-values", "kubernetes"],
        addLabels: ["stack:kubernetes"],
      },
      {
        description: "Automerge GitHub/Gitea Actions patch/minor updates",
        matchManagers: ["github-actions"],
        matchUpdateTypes: ["patch", "minor", "digest"],
        groupName: "ci action updates",
        groupSlug: "ci-actions",
        automerge: true,
        automergeType: "pr",
        platformAutomerge: false, // Wait for tests to pass first
        addLabels: ["stack:ci"],
      },
      {
        description: "Require manual approval for major updates",
        matchUpdateTypes: ["major"],
        dependencyDashboardApproval: true,
        automerge: false,
        addLabels: ["major-update"],
      },
      {
        description: "Security PR labels and behavior for OSV/security-related updates",
        matchCategories: ["security"],
        addLabels: ["security", "dependencies", "renovate"],
        semanticCommitType: "fix",
        automerge: false,
      },
    ],

    // Kept customManagers empty to rely on built-in helm-values and github-actions managers
    customManagers: [],
  },
};
