# syntax=docker/dockerfile:1.27.1
ARG SURREALDB_VERSION=v3.3.0

FROM python:3.14.8-slim-trixie AS python-base

ENV PYTHONFAULTHANDLER=1 \
    PYTHONHASHSEED=random \
    PYTHONUNBUFFERED=1

FROM python-base AS requirements-stage

WORKDIR /tmp

COPY --from=ghcr.io/astral-sh/uv:0.12.20 /uv /usr/local/bin/uv
COPY ./pyproject.toml ./uv.lock* /tmp/

ARG VARIANT=regular
RUN if [ "$VARIANT" = "all" ]; then \
        uv export --no-dev --no-hashes --frozen --no-emit-project --group all -o requirements.txt; \
    else \
        uv export --no-dev --no-hashes --frozen --no-emit-project -o requirements.txt; \
    fi

FROM python-base AS python-deps

WORKDIR /tmp

COPY --from=requirements-stage /usr/local/bin/uv /usr/local/bin/uv
COPY --from=requirements-stage /tmp/requirements.txt ./requirements.txt
# Native dependencies have wheels for both supported architectures. The two
# source-only packages in the all variant build pure Python wheels.
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --python /usr/local/bin/python --prefix=/install --link-mode=copy -r ./requirements.txt

# The SPA and Bun JavaScript bundle are architecture-independent.
FROM --platform=$BUILDPLATFORM oven/bun:1.4.2-slim AS front-build

WORKDIR /app

COPY /package.json /bun.lock* ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile

COPY /tsconfig.json /vite.config.ts ./
COPY /tooling ./tooling
COPY /src ./src
COPY /runtime ./runtime
COPY /public ./public
COPY /bun-entry.ts /index.html ./

RUN bun run build
RUN bun build bun-entry.ts --target=bun --outfile ./bun-server.js
RUN bun build runtime/config-cli.ts --target=bun --outfile ./config-cli.js

# Keep the runtime binary on the target architecture, even when front-build
# runs on a different architecture.
FROM oven/bun:1.4.2-slim AS bun-runtime

FROM surrealdb/surrealdb:${SURREALDB_VERSION} AS surreal-runtime

FROM python-base

WORKDIR /app

# Install runtime deps only
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl unzip zip libstdc++6 libgcc-s1 \
    && rm -rf /var/lib/apt/lists/*

# Copy the pinned runtime binaries for the target architecture.
COPY --from=bun-runtime /usr/local/bin/bun /usr/local/bin/bun
COPY --from=surreal-runtime /surreal /usr/local/bin/surreal

# Create data directory for persistent SurrealDB storage
RUN mkdir /data

# Copy prebuilt Python dependencies (cached by requirements.txt)
COPY --from=python-deps /install /usr/local

# Copy Python server code
COPY ./server ./server

# Copy built frontend SPA and bundled Bun entry point
COPY --from=front-build /app/dist ./dist
COPY --from=front-build /app/bun-server.js ./bun-server.js
COPY --from=front-build /app/config-cli.js ./config-cli.js
COPY --from=front-build /app/runtime/search-index-schema.surql ./search-index-schema.surql

# Set environment for production
ENV NODE_ENV=production

# Avoid running as root
RUN useradd -m -s /usr/sbin/nologin myuser
RUN chown -R myuser:myuser /app /data
USER myuser

# Expose main port and SurrealDB storage volume
EXPOSE 8555/tcp
VOLUME /data

CMD ["bun", "--no-env-file", "/app/bun-server.js"]

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s \
    CMD curl --fail http://localhost:8555/health || exit 1
