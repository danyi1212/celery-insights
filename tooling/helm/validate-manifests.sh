#!/usr/bin/env bash
set -euo pipefail
chart=charts/celery-insights
helm template contract "$chart" --kube-version 1.35.0 | kubeconform -strict -summary -kubernetes-version 1.35.0
for profile in persistent existing-claim external autoscaling configuration; do
    helm template contract "$chart" --kube-version 1.35.0 -f "$chart/examples/$profile.yaml" | kubeconform -strict -summary -kubernetes-version 1.35.0
done
