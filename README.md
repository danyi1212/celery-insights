# Celery Insights

Celery Insights is a real-time dashboard for Celery clusters. It shows workers, tasks, task graphs, and cluster activity in a web UI backed by Celery events and live updates.
Its read-only MCP interface lets agents find workflows, inspect task inputs/results/errors, and see stored worker activity.

<p align="center">
  <a href="https://celery-insights.vercel.app/" rel="noopener" target="_blank"><img height="40" src="/assets/ViewDemo.svg" alt="View Demo"></a>
</p>

## Quick Start

Configure an explicit account in a secret-backed TOML file and HTTPS ingress before starting the container. See [application authentication](CONFIGURATION.md#application-authentication) for password-file and environment references. Then run:

```shell
docker run -p 127.0.0.1:8555:8555 --name celery-insights \
  -v "$PWD/config.toml:/etc/celery-insights/config.toml:ro" \
  --env-file deployment.env ghcr.io/danyi1212/celery-insights:latest
```

Open the HTTPS public URL configured in `installation.public_url`. The browser prompts for a configured username and password. Built-in operator docs are available under `/documentation` at the same URL.

## Required Celery Event Settings

Celery Insights relies on Celery events to populate workers, task state transitions, and task detail pages.

```python
from celery import Celery

app = Celery("myapp")
app.conf.worker_send_task_events = True
app.conf.task_send_sent_event = True
app.conf.task_track_started = True  # optional, but recommended
app.conf.result_extended = True  # optional, but recommended
```

Keep the rest of the event-related settings at their Celery defaults unless your deployment already requires something different.

[Celery event configuration documentation](https://docs.celeryq.dev/en/stable/userguide/configuration.html#events)

## Common Deployment Changes

The default image assumes RabbitMQ as the broker and Redis as the result backend, both reachable from inside Docker via `host.docker.internal`.

- Use [`BROKER_URL`](CONFIGURATION.md#broker_url) and [`RESULT_BACKEND`](CONFIGURATION.md#result_backend) when your Celery cluster uses different endpoints.
- Set [`URL_PREFIX`](CONFIGURATION.md#url_prefix) when hosting under a shared reverse proxy path such as `/tools/celery/`.
- Use [`CONFIG_FILE`](CONFIGURATION.md#config_file) when the cluster needs Redis Sentinel, transport options, TLS settings, or custom serializers.
- Use `ghcr.io/danyi1212/celery-insights-all:latest` when your Celery setup needs optional extras such as `msgpack`, S3, Memcache, or other non-default drivers.
- Pick the right SurrealDB topology with [`SURREALDB_STORAGE`](CONFIGURATION.md#surrealdb_storage) or [`SURREALDB_EXTERNAL_URL`](CONFIGURATION.md#surrealdb_external_url).

Example with Redis as the broker and Memcache as the result backend:

```shell
docker run -p 127.0.0.1:8555:8555 --name celery-insights \
  -v "$PWD/config.toml:/etc/celery-insights/config.toml:ro" --env-file deployment.env \
  -e BROKER_URL=redis://host.docker.internal:6379/0 \
  -e RESULT_BACKEND=cache+memcached://host.docker.internal:11211/ \
  ghcr.io/danyi1212/celery-insights-all:latest
```

## MCP access for agents

The read-only MCP endpoint uses the same configured-account authentication and permissions as the dashboard. Configure clients to send Basic credentials, the configured Origin and `X-Celery-Insights-Request: 1` over HTTPS. See [MCP client setup](CONFIGURATION.md#mcp-access-for-agents) for the header contract and cursor signing. There is no separate token login or anonymous default.

Ask an agent: “Find the `reports.render` task I spawned in the last 15 minutes and tell me whether it finished.” See [the tool contract](MCP_DESIGN.md) for arguments, responses and pagination.

## Documentation

- [`CONFIGURATION.md`](CONFIGURATION.md) for the full environment variable reference, setup patterns, metrics endpoints, and reverse-proxy behavior
- [`Support Matrix`](CONFIGURATION.md#support-matrix) for broker, serializer, and result-backend compatibility
- [`MCP_DESIGN.md`](MCP_DESIGN.md) for MCP tool arguments, responses, filters, and pagination
- [`CONTRIBUTING.md`](CONTRIBUTING.md) for local development, testing, and contribution guidelines

## Questions, Bugs, and Security Reports

If you hit a bug, please open an issue with a minimal reproduction. For questions, ideas, and feature requests, start with GitHub Discussions when possible.

If you have discovered a security vulnerability, do not file a public issue. Report it privately to `security@danyi.io`.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for local setup, code-style expectations, and test commands.

## License

Celery Insights is licensed under the BSD 3-Clause License. See [`LICENSE`](LICENSE) for details.
