# Celery Insights

Celery Insights is a real-time dashboard for Celery clusters. It shows workers, tasks, task graphs, and cluster activity in a web UI backed by Celery events and live updates.

<p align="center">
  <a href="https://celery-insights.vercel.app/" rel="noopener" target="_blank"><img height="40" src="/assets/ViewDemo.svg" alt="View Demo"></a>
</p>

## Quick Start

Run the published container:

```shell
docker run -p 8555:8555 --name celery-insights ghcr.io/danyi1212/celery-insights:latest
```

Then open <http://localhost:8555/>. Once the app is running, the built-in operator docs are also available at <http://localhost:8555/documentation>.

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
- Use [`CONFIG_FILE`](CONFIGURATION.md#config_file) when the cluster needs Redis Sentinel, transport options, TLS settings, or custom serializers.
- Use `ghcr.io/danyi1212/celery-insights-all:latest` when your Celery setup needs optional extras such as `msgpack`, S3, Memcache, or other non-default drivers.
- Pick the right SurrealDB topology with [`SURREALDB_STORAGE`](CONFIGURATION.md#surrealdb_storage) or [`SURREALDB_EXTERNAL_URL`](CONFIGURATION.md#surrealdb_external_url).

Example with Redis as the broker and Memcache as the result backend:

```shell
docker run -p 8555:8555 --name celery-insights \
  -e BROKER_URL=redis://host.docker.internal:6379/0 \
  -e RESULT_BACKEND=cache+memcached://host.docker.internal:11211/ \
  ghcr.io/danyi1212/celery-insights-all:latest
```

## Documentation

- [`CONFIGURATION.md`](CONFIGURATION.md) for the full environment variable reference, setup patterns, metrics endpoints, and reverse-proxy behavior
- [`Support Matrix`](CONFIGURATION.md#support-matrix) for broker, serializer, and result-backend compatibility
- [`CONTRIBUTING.md`](CONTRIBUTING.md) for local development, testing, and contribution guidelines

## Questions, Bugs, and Security Reports

If you hit a bug, please open an issue with a minimal reproduction. For questions, ideas, and feature requests, start with GitHub Discussions when possible.

If you have discovered a security vulnerability, do not file a public issue. Report it privately to `danyi1212@users.noreply.github.com`.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for local setup, code-style expectations, and test commands.

## License

Celery Insights is licensed under the BSD 3-Clause License. See [`LICENSE`](LICENSE) for details.
