# Configuration

Celery Insights can be configured using environment variables.
Additional preferences can be found on the Settings page within the app.

By default, Celery Insights uses only Broker URL and Result Backend to connect to your Celery Cluster.

In case you have set up a [Config File](#setup-with-config-file),
Celery Insights will prefer it over the `BROKER_URL` and `RESULT_BACKEND` environment variables.

If your setup requires
[extra Celery dependencies](https://docs.celeryq.dev/en/main/getting-started/introduction.html#bundles)
(e.g. msgpack, sqs, etc.), you may use the `celery-insights-all` Docker image instead.


> :exclamation: Tip
>
> If you want Celery Insights to access a local service, like a Redis container, use `host.docker.internal` instead
of `localhost`.
> [See more on Docker docs](https://docs.docker.com/desktop/networking/#use-cases-and-workarounds-for-all-platforms)

### BROKER_URL

Default: `amqp://guest:guest@host.docker.internal/`

Specify the Celery Broker URL.
[See more on Celery docs.](https://docs.celeryq.dev/en/stable/userguide/configuration.html#broker-url)

### RESULT_BACKEND

Default: `redis://host.docker.internal:6379/0`

Specify the Celery Result Backend.
See more on Celery docs.](https://docs.celeryq.dev/en/stable/userguide/configuration.html#result-backend)]

### CONFIG_FILE

Default: `/app/config.py`

Specify the path where the Config File should be located for Celery Insights.
For instructions on how to set it up, refer to the [Setup with Config File](#setup-with-config-file) section.

### MAX_TASKS

Default `10000`

Specify how many tasks can be stored in memory.

### MAX_WORKERS

Default `5000`

Specify how many workers can be stored in memory.

### HOST

Default: `0.0.0.0`

Specify Celery Insights hostname. By default, it will listen to all IP addresses.

### PORT

Default: `8555`

Specify Celery Insights port number.

### TIMEZONE

Default: "UTC"

Specify the time zone for your cluster.
For correct timestamps, it should be the same as your Celery nodes.
All timestamps shown on the app are translated to the client's local timezone.

### DEBUG

Default: `False`

Enables Celery Insights to run in debug mode, that includes hot-reload, response tracebacks and Celery event logs.

# Setup with Config File

In certain situations, connecting to your Celery cluster may require more than simply specifying the Broker URL and
Result Backend.
For such cases, you can configure Celery Insights
using a [Celery configuration file](https://docs.celeryq.dev/en/stable/userguide/configuration.html).

Create a `config.py` file containing all the necessary Celery configurations. For example:

```python
broker_url = 'sentinel://localhost:26379;sentinel://localhost:26380;sentinel://localhost:26381'
broker_transport_options = {
    'sentinel_kwargs': {
        'master_name': "cluster1",
        'password': "password",
    },
}
result_backend_transport_options = {'master_name': "cluster1"}
result_accept_content = "msgpack"
```

Then mount it inside Celery Insights container, for example:

```shell
docker run -v ./config.py:/app/config.py -p 8555:8555 --name celery-insights ghcr.io/danyi1212/celery-insights:latest
```

## Support chart

:white_check_mark: - Fully Supported
:heavy_check_mark: - Supported with `celery-insights-all`
:ballot_box_with_check: - Limited features
:x: - Not supported

### Serializers

* :heavy_check_mark: auth
* :heavy_check_mark: msgpack
* :heavy_check_mark: yaml

### Brokers

* :white_check_mark: RabbitMQ
* :white_check_mark: Redis
* :x: Amazon SQS
* :heavy_check_mark: Zookeeper

### Result Backends

* :white_check_mark: Redis
* :ballot_box_with_check: RPC
* :heavy_check_mark: Memcache
* :heavy_check_mark: SQLAlchemy
* :heavy_check_mark: MongoDB
* :x: Casandra
* :x: IronCache
* :heavy_check_mark: S3
* :heavy_check_mark: Azure Block Blob
* :heavy_check_mark: ElasticSearch
* :heavy_check_mark: AWS DynamoDB
* :x: Couchbase
* :heavy_check_mark: CouchDB
* :heavy_check_mark: ArangoDB
* :heavy_check_mark: CosmoDB
* :ballot_box_with_check: File-System
* :heavy_check_mark: Consul
* :heavy_check_mark: Riak
* :x: Django ORM

Feel free to [submit a feature request](CONTRIBUTING.md) to support more setups.
