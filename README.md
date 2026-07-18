# GLPX Default Repository (`.github`)

Default community health files and the global **Gitea Actions** reusable workflow library for
the [Glowing Pixels UG (GLPX)](https://gitea.bk.glpx.pro/mukimovd) ecosystem.

These files provide shared contribution, conduct, security, support, issue, and pull-request
guidance for repositories under the `glpx` and `mukimovd` Gitea namespaces that do not define
their own project-specific versions. Repository-specific files take precedence over these
defaults.

## Where things live

- **`.gitea/workflows/`** — the canonical reusable Gitea Actions workflows (one per stack) and
  the global Renovate runner. See [`.gitea/README.md`](./.gitea/README.md) for the catalog and
  the secrets strategy.
- **`.gitea/actions/`** — composite actions. Local-only; see
  [`.gitea/actions/README.md`](./.gitea/actions/README.md) for the cross-repo caveat.
- **`config.js`** + **`renovate.json`** — the global Renovate bot config and the per-repo
  preset consumers extend. Renovate is the **sole** dependency updater for this fleet
  (Dependabot is intentionally not used).
- **`profile/README.md`** — the org profile page shown on both Gitea and GitHub.
- **`BASE_IMAGES.md`** — base-image policy for `glpx/*` and `mukimovd/*` Dockerfiles.
- **`templates/`** — consumer CI scaffolds; see [`ONBOARDING.md`](./ONBOARDING.md).
- **`ORGANIZATION_SETTINGS.md`** — reference checklist for org-level branch protection / Actions / security settings (applied in the Gitea UI, not enforced here).

> [!NOTE]
> **GitHub is a read-only mirror.** The source of truth is
> [`gitea.bk.glpx.pro/mukimovd/.github`](https://gitea.bk.glpx.pro/mukimovd/.github). Pull
> requests and issues are handled on Gitea; no `.github/workflows/` directory exists here
> because CI only runs on Gitea Actions.
