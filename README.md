# Celery Insights

Welcome to Celery Insights, the ultimate monitoring tool for your Celery cluster!

With Celery Insights, you can effortlessly track your Celery cluster in real-time. 
Our modern web interface enables you to conveniently view worker status, 
task information, and workflow graphs, all updated using websockets.

Inspired by Celery Flower, this tool takes Celery monitoring to the next level.  
Try Celery Insights and transform the way you monitor your Celery cluster!

## Getting Started

Celery Insights is provided as a Docker image and can be launched using a single command:
```shell
docker run -p 8555:8555 --name celery-insights ghcr.io/danyi1212/celery-insights:latest
```

Next, navigate to `http://localhost:8555/` and begin the welcome tour.

### Advanced setup
Celery Insights comes pre-configured for localhost Redis as Result Backend and RabbitMQ as Broker.

Utilize the [BROKER_URL](CONFIGURATION.md#brokerurl) and [RESULT_BACKEND](CONFIGURATION.md#resultbackend) environment variables to customize the
configuration for your specific setup.
For instance, the following example demonstrates a setup with Redis as the Broker and Memcache as the Result Backend:
```shell
docker run -p 8555:8555 --name celery-insights -e BROKER_URL=redis://host.docker.internal:6379/0 -e RESULT_BACKEND=cache+memcached://host.docker.internal:11211/ ghcr.io/danyi1212/celery-insights:latest
```
If you need more advanced Celery configuration, you can configure using a [Config File](CONFIGURATION.md#setup-with-config-file).

### Asking Questions and Reporting Bugs

If you've found a bug, we would like to know, so we can fix it!
You might find immediate answers to your questions in our [support chart](CONFIGURATION.md#support-chart).
Please review the [contributing guidelines](CONTRIBUTING.md) for guidance on getting started.

For any questions, suggestions, or feature requests, please join the conversation in GitHub Discussions.

> :warning: **WARNING**
>
> If you have discovered a security vulnerability, please **DO NOT** file a public issue.  
> Instead, please report them directly to danyi1212@users.noreply.github.com.

## Contributing

To contribute to Celery Insights, please review the [contributing guidelines](CONTRIBUTING.md) for guidance on how to
get started.

## License

Celery Insights is licensed under the BSD 3-clause license. See the [LICENSE](LICENSE) file for details.

### Thank you for exploring Celery Insights! We hope it proves to be a valuable addition to your Celery cluster.
