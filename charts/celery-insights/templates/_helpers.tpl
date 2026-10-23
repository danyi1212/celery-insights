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
{{/* TOML recursive tables and inline tables support arrays of accounts and role
mappings. Null is rejected because TOML has no null value. */}}
{{- define "insights.tomlScalar" -}}
{{- if eq . nil -}}{{ fail "TOML has no null value" }}{{- end -}}
{{- if kindIs "map" . -}}
{{- $data := . -}}{ {{ range $i, $key := keys $data | sortAlpha }}{{ if $i }}, {{ end }}{{ $key | toJson }} = {{ include "insights.tomlScalar" (index $data $key) }}{{ end }} }
{{- else if kindIs "slice" . -}}
[{{- range $i, $v := . -}}{{ if $i }}, {{ end }}{{ include "insights.tomlScalar" $v }}{{- end -}}]
{{- else -}}{{ toJson . }}{{- end -}}
{{- end -}}
{{- define "insights.generatedConfig" -}}
schema_version = 1
[installation]
public_url = {{ .Values.authentication.publicUrl | toJson }}
[authentication]
mode = {{ .Values.authentication.mode | toJson }}
{{ if eq .Values.authentication.mode "basic" }}
[[authentication.accounts]]
username = {{ .Values.authentication.basic.username | toJson }}
password_env = "INSIGHTS_ACCOUNT_PASSWORD"
roles = {{ include "insights.tomlScalar" .Values.authentication.basic.roles }}
{{ else }}
[authentication.oidc]
issuer = {{ .Values.authentication.oidc.issuer | toJson }}
client_id = {{ .Values.authentication.oidc.clientId | toJson }}
scopes = {{ .Values.authentication.oidc.scopes | toJson }}
role_mappings = {{ include "insights.tomlScalar" .Values.authentication.oidc.roleMappings }}
{{ end }}
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
