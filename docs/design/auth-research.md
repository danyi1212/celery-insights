# Authentication scope decision

Celery Insights does not host an authentication platform. Simple deployments use explicitly configured password accounts with a browser login page; passwords can be inline TOML secrets or references to a mounted file/environment variable. Production deployment requires HTTPS ingress.

Customers requiring SSO, MFA, recovery or managed accounts use their identity provider through a maintained OIDC integration. Better Auth, custom password hashing, MFA encryption, account/session databases and lifecycle APIs are outside the configured-account scope.

The application owns verified identity-to-role mapping, permission checks and optional restrictive OPA decisions. Python owns only the Celery bridge. See [the implementation plan](authentication-authorization.md) for the concrete interface, deployment requirements and remaining work. PR #143 integrates `openid-client` and `jose`; shared encrypted cookies support both configured passwords and OIDC without a session database. Explicit Basic headers remain for programmatic clients.
