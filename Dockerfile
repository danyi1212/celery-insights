# syntax=docker/dockerfile:1.7
FROM python:3.12-slim AS python-base

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

FROM oven/bun:alpine AS front-build

WORKDIR /frontend

COPY /frontend/package.json /frontend/bun.lock* ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile

COPY /frontend/ .
RUN bun run build

FROM python-base

WORKDIR /app

# Install runtime deps only
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl bash unzip libstdc++6 libgcc-s1 nginx gettext-base \
    && rm -rf /var/lib/apt/lists/*

# Install Bun runtime (to /usr/local/bin so all users can access it)
RUN curl -fsSL https://bun.sh/install | bash \
    && mv /root/.bun/bin/bun /usr/local/bin/bun \
    && rm -rf /root/.bun

# Install SurrealDB binary (pinned v2.1.x)
ARG SURREALDB_VERSION=v2.1.4
RUN curl -fsSL https://install.surrealdb.com | sh -s -- --version ${SURREALDB_VERSION} \
    && command -v surreal

ENV LOG_FILE_PATH=/app/logs/app.log
RUN mkdir /app/logs

# Create data directory for persistent SurrealDB storage
RUN mkdir /data

# Copy prebuilt Python dependencies (cached by requirements.txt)
COPY --from=python-deps /install /usr/local

# Copy Python server code
COPY ./server ./server

# Copy built frontend SPA and Bun entry point + src/ modules
COPY --from=front-build /frontend/dist ./dist
COPY --from=front-build /frontend/bun-entry.ts ./bun-entry.ts
COPY --from=front-build /frontend/src ./src
COPY --from=front-build /frontend/node_modules ./node_modules
COPY --from=front-build /frontend/package.json ./package.json
COPY ./deploy ./deploy
RUN chmod +x /app/deploy/start.sh

# Set environment for production
ENV NODE_ENV=production

# Avoid running as root
RUN useradd -m -s /bin/bash myuser
RUN chown -R myuser:myuser /app /data
USER myuser

# Expose main port and SurrealDB storage volume
EXPOSE 8555/tcp
VOLUME /data

CMD ["/app/deploy/start.sh"]

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s \
    CMD curl --fail http://localhost:8555/health || exit 1
