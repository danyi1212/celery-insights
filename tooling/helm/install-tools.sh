#!/usr/bin/env bash
set -euo pipefail
# Linux CI only. Keep binaries private to the runner and verify official checksums.
HELM_VERSION="${HELM_VERSION:-4.3.0}"
tools_dir="${RUNNER_TEMP:?}/celery-helm-tools"
mkdir -p "$tools_dir/bin"
cd "$tools_dir"
curl -fsSLO "https://get.helm.sh/helm-v${HELM_VERSION}-linux-amd64.tar.gz"
curl -fsSLO "https://get.helm.sh/helm-v${HELM_VERSION}-linux-amd64.tar.gz.sha256sum"
sha256sum -c "helm-v${HELM_VERSION}-linux-amd64.tar.gz.sha256sum"
tar -xzf "helm-v${HELM_VERSION}-linux-amd64.tar.gz"
cp linux-amd64/helm bin/helm
curl -fsSL https://github.com/kubernetes-sigs/kind/releases/download/v0.31.0/kind-linux-amd64 -o bin/kind-linux-amd64
curl -fsSL https://github.com/kubernetes-sigs/kind/releases/download/v0.31.0/kind-linux-amd64.sha256sum -o kind.sha256sum
(cd bin && sha256sum -c ../kind.sha256sum)
mv bin/kind-linux-amd64 bin/kind
curl -fsSLO https://github.com/yannh/kubeconform/releases/download/v0.7.0/kubeconform-linux-amd64.tar.gz
curl -fsSLO https://github.com/yannh/kubeconform/releases/download/v0.7.0/CHECKSUMS
awk '$2 == "kubeconform-linux-amd64.tar.gz" {print}' CHECKSUMS | sha256sum -c -
tar -xzf kubeconform-linux-amd64.tar.gz -C bin kubeconform
chmod +x bin/*
echo "$tools_dir/bin" >> "${GITHUB_PATH:?}"
