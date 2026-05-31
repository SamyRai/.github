# AI Coding Assistant Instructions

Welcome to the **Glowing Pixels UG (GLPX)** ecosystem! 

When generating code, writing infrastructure manifests, or answering questions within this repository, please adhere to the following architectural and stylistic guidelines:

## 1. Operating Model & Source Control
- **Gitea-First**: The GLPX source-control operating model is strictly Gitea-first. Active development and GitOps writes happen on Gitea (`gitea.bk.glpx.pro`). GitHub is used strictly as a read-only outbound mirror.
- Do not suggest or write workflows that rely exclusively on GitHub Actions unless specified. Always ensure compatibility with Gitea Actions.

## 2. Infrastructure & Kubernetes
- **Hub-and-Spoke GitOps**: The cluster is divided into a Hub (`Baikonur` context) running ArgoCD and managing workloads, and a Spoke (`Mir` context) running core services (Vault, PostgreSQL).
- **ArgoCD**: All Kubernetes workloads should be defined declaratively for ArgoCD. Do not suggest imperative `kubectl apply` commands for permanent infrastructure.
- **K3s**: We use K3s. Avoid suggesting configurations specific to EKS, GKE, or AKS.
- **Ingress**: We use Traefik. Do not write Nginx Ingress annotations. TLS is managed via `cert-manager` using the `namecheap-dns01` ClusterIssuer.

## 3. Security & Secrets
- **HashiCorp Vault**: We use HashiCorp Vault Secrets Operator (VSO) to sync secrets from Vault into Kubernetes Secrets. Do not hardcode credentials in Helm values or suggest using sealed-secrets or external-secrets.
- **Network Isolation**: State is shared between clusters securely via WireGuard tunnels.

## 4. Coding Languages & Tools
- **Go**: For custom CLI tools, SDKs, or DevOps utilities (like `gitea-github-sync`, `wg-manager`), prefer Go.
- **Helm**: Ensure all Helm templates pass `helm template` validation.

## 5. Style
- Use Markdown alerts (`> [!NOTE]`, `> [!WARNING]`) in documentation.
- Keep bash scripts strict (`set -euo pipefail`).
