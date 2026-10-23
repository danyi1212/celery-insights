"""Diagnostic native LIVE burst probe; not a sustainable-throughput benchmark."""

import argparse
import asyncio
import json
import os
import sys
from uuid import uuid4

from surrealdb import AsyncSurreal
from websockets.exceptions import ConnectionClosed

from pipeline import query


async def probe(url: str, count: int) -> dict:
    database = f"live_burst_{uuid4().hex}"
    writer = AsyncSurreal(url)
    reader = AsyncSurreal(url)
    consumer = None
    seen = set()
    try:
        for db in (writer, reader):
            await db.signin(
                {
                    "username": os.environ.get("BENCH_PROBE_USER", "root"),
                    "password": os.environ.get("BENCH_PROBE_PASSWORD", "root"),
                }
            )
            await db.use("benchmark_diagnostics", database)
        await query(writer, "DEFINE TABLE observation SCHEMALESS")
        stream = await reader.subscribe_live(await reader.live("observation"))

        async def consume() -> None:
            async for row in stream:
                seen.add(str(row["id"]))

        consumer = asyncio.create_task(consume())
        await query(writer, f"BEGIN; CREATE |observation:{count}| SET value = 1; COMMIT")
        # Observe the burst, then actively probe: this SDK's subscription iterator can
        # wait indefinitely after its connection closes without yielding an exception.
        await asyncio.sleep(1)
        error = None
        try:
            await asyncio.wait_for(query(reader, "RETURN true"), timeout=2)
        except (ConnectionClosed, TimeoutError, RuntimeError) as failure:
            error = f"{type(failure).__name__}: {failure}"
        persisted = await query(writer, "SELECT count() AS count FROM observation GROUP ALL")
        return {
            "batch_records": count,
            "observed_records": len(seen),
            "persisted_records": persisted[0]["count"],
            "connection_error": error,
            "delivery_complete": len(seen) == count and error is None,
            "limitations": [
                "One atomic burst, one fast Python SDK consumer; not an offered arrival-rate measurement.",
                "One-second observation window; repeat runs and compare burst shapes before deriving limits.",
            ],
        }
    finally:
        if consumer:
            consumer.cancel()
            await asyncio.gather(consumer, return_exceptions=True)
        try:
            await query(writer, f"REMOVE DATABASE {database}")
        finally:
            await reader.close()
            await writer.close()


async def main(arguments: argparse.Namespace) -> None:
    for _ in range(arguments.repetitions):
        for count in arguments.counts:
            sys.stdout.write(json.dumps(await probe(arguments.url, count), default=str) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True, help="RPC URL of a disposable native database with owner access")
    parser.add_argument("--counts", nargs="+", type=int, default=[64, 256, 1024])
    parser.add_argument("--repetitions", type=int, default=1)
    args = parser.parse_args()
    if min(args.counts) <= 0 or args.repetitions <= 0:
        parser.error("counts and repetitions must be positive")
    asyncio.run(main(args))
