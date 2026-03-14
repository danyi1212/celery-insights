# syntax=docker/dockerfile:1.7
FROM python:3.14-slim AS python-base

ENV PYTHONFAULTHANDLER=1 \
    PYTHONHASHSEED=random \
    PYTHONUNBUFFERED=1

RUN pip install --upgrade pip

FROM python-base AS requirements-stage

WORKDIR /tmp

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY ./pyproject.toml ./uv.lock* /tmp/

ARG VARIANT=regular
RUN if [ "$VARIANT" = "all" ]; then \
        uv export --no-hashes --frozen --no-emit-project --group all -o requirements.txt; \
    else \
        uv export --no-hashes --frozen --no-emit-project -o requirements.txt; \
    fi

FROM python-base AS python-deps

WORKDIR /tmp

# Build-time toolchain for native Python deps (e.g. surrealdb via Rust/maturin)
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential cargo rustc \
    && rm -rf /var/lib/apt/lists/*

COPY --from=requirements-stage /tmp/requirements.txt ./requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade --prefix=/install -r ./requirements.txt --no-warn-script-location

FROM oven/bun:1-slim AS front-build

WORKDIR /frontend

COPY /frontend/package.json /frontend/bun.lock* ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile

COPY /frontend/ .
RUN bun run build
RUN bun build bun-entry.ts --target=bun --outfile ./bun-server.js

FROM python-base

WORKDIR /app

# Install runtime deps only
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl unzip zip libstdc++6 libgcc-s1 \
    && rm -rf /var/lib/apt/lists/*

# Copy Bun runtime from the build image instead of installing it again.
COPY --from=front-build /usr/local/bin/bun /usr/local/bin/bun

# Install SurrealDB binary (pinned v3.0.x)
ARG SURREALDB_VERSION=v3.0.2
RUN curl -fsSL https://install.surrealdb.com | sh -s -- --version ${SURREALDB_VERSION} \
    && command -v surreal \
    && rm -rf /var/lib/apt/lists/*

# Create data directory for persistent SurrealDB storage
RUN mkdir /data

# Copy prebuilt Python dependencies (cached by requirements.txt)
COPY --from=python-deps /install /usr/local

# Copy Python server code
COPY ./server ./server

# Copy built frontend SPA and bundled Bun entry point
COPY --from=front-build /frontend/dist ./dist
COPY --from=front-build /frontend/bun-server.js ./bun-server.js

# Set environment for production
ENV NODE_ENV=production

# Avoid running as root
RUN useradd -m -s /usr/sbin/nologin myuser
RUN chown -R myuser:myuser /app /data
USER myuser

# Expose main port and SurrealDB storage volume
EXPOSE 8555/tcp
VOLUME /data

CMD ["bun", "/app/bun-server.js"]

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s \
    CMD curl --fail http://localhost:8555/health || exit 1
