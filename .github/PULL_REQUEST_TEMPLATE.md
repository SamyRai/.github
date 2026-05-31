## Description
Please include a summary of the change and which issue is fixed. If this is a GitOps change, clarify which cluster (Baikonur or Mir) is affected.

Fixes # (issue)

## Type of change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] GitOps/Infrastructure (Helm, Kustomize, ArgoCD Application changes)

## Checklist:
- [ ] My code follows the style guidelines of Glowing Pixels
- [ ] I have performed a self-review of my own code
- [ ] I have verified that changes to manifests pass `helm template` checks
- [ ] I have updated the documentation (e.g. `ARCHITECTURE.md` or Runbooks) if applicable
- [ ] For infrastructure changes, I have tested deploying this to a dev namespace

## Deployment Notes (ArgoCD / Kubernetes)
_Add any specific notes for reviewers regarding how ArgoCD should sync this, or if any Vault secrets need to be provisioned prior to sync._
