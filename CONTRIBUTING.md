# Contributing to Glowing Pixels UG

We love your input! We want to make contributing to this project as easy and transparent as possible.

## Our Operating Model: Gitea-First
The Glowing Pixels source-control operating model is **Gitea-first**: 
- **Active development and GitOps writes happen in Gitea** (`https://gitea.bk.glpx.pro`).
- GitHub is used **only as an outbound backup mirror**. Please do not open PRs on GitHub, as they will not trigger our primary CI/CD pipelines.

## Pull Requests
1. Fork the repo and create your branch from `main`.
2. Ensure your changes align with our strictly isolated Hub-and-Spoke GitOps model.
3. If you've changed APIs or Infrastructure, update the corresponding Runbooks or `ARCHITECTURE.md`.
4. Ensure the test suite passes (including Trivy scans for images).
5. Open your Pull Request on our Gitea instance!
