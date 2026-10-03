{{- define "insights.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- define "insights.fullname" -}}
{{- default (printf "%s-%s" .Release.Name (include "insights.name" .)) .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- define "insights.selector" -}}
app.kubernetes.io/name: {{ include "insights.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
{{- define "insights.labels" -}}
{{ include "insights.selector" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | quote }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end -}}
{{- define "insights.databaseUrl" -}}
{{- if .Values.surrealdb.enabled -}}
{{- $ctx := dict "Values" .Values.surrealdb "Chart" (dict "Name" "surrealdb") "Release" .Release -}}
{{- printf "ws://%s:%v/rpc" (include "surrealdb.fullname" $ctx) .Values.surrealdb.service.port -}}
{{- else -}}
{{- required "database.externalUrl is required when surrealdb.enabled=false" .Values.database.externalUrl -}}
{{- end -}}
{{- end -}}
{{/* TOML recursive tables: quoted keys and JSON scalar syntax are valid TOML for
strings/numbers/booleans and homogeneous arrays. Null/maps in arrays are rejected. */}}
{{- define "insights.tomlScalar" -}}
{{- if eq . nil -}}{{ fail "TOML has no null value" }}{{- end -}}
{{- if kindIs "map" . -}}{{ fail "TOML arrays of objects require raw TOML content" }}{{- end -}}
{{- if kindIs "slice" . -}}
[{{- range $i, $v := . -}}{{ if $i }}, {{ end }}{{ include "insights.tomlScalar" $v }}{{- end -}}]
{{- else -}}{{ toJson . }}{{- end -}}
{{- end -}}
{{- define "insights.toml" -}}
{{- $data := .data -}}{{- $path := .path -}}
{{- range $key := keys $data | sortAlpha -}}
{{- $value := index $data $key -}}
{{- if not (kindIs "map" $value) }}
{{ $key | toJson }} = {{ include "insights.tomlScalar" $value }}
{{ end -}}
{{- end -}}
{{- range $key := keys $data | sortAlpha -}}
{{- $value := index $data $key -}}
{{- if kindIs "map" $value -}}
{{- $next := append $path ($key | toJson) }}
[{{ join "." $next }}]
{{ include "insights.toml" (dict "data" $value "path" $next) }}
{{ end -}}
{{- end -}}
{{- end -}}
{{- define "insights.secretEnv" -}}
- name: {{ .env }}
  valueFrom:
    secretKeyRef:
      name: {{ .root.Values.credentials.existingSecret | quote }}
      key: {{ index .root.Values.credentials.keys .key | quote }}
{{- end -}}
