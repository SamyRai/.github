# Welcome to Glowing Pixels UG (GLPX) 👋

We are the engineering hub for the GLPX ecosystem. 

Our infrastructure is built on a strictly isolated **Hub-and-Spoke GitOps** model, heavily relying on Kubernetes (K3s), ArgoCD, and Gitea.

### 🛰️ Our Infrastructure Topology
- **Baikonur (Hub)**: Our primary control plane running ArgoCD, managing application workloads and internal Traefik routing.
- **Mir (Spoke)**: Our highly available core services layer running HashiCorp Vault (Raft HA), CloudNativePG, and Longhorn HA.

### 🛠️ Tech Stack
- **GitOps**: ArgoCD, Helm, Kustomize
- **Source Control**: Gitea (Primary), GitHub (Mirror)
- **Secrets**: HashiCorp Vault & Vault Secrets Operator
- **Databases**: CloudNativePG, Redis, Qdrant, Neo4j
- **Registry**: Harbor (`registry.bk.glpx.pro`)

---
*Note: Our repositories on GitHub are read-only mirrors. All active development occurs on our internal Gitea instance.*
