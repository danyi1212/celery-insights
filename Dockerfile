FROM python:3.12-alpine AS python-base

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

FROM oven/bun:alpine AS front-build

WORKDIR /frontend

COPY /frontend/package.json /frontend/bun.lock* ./
RUN bun install --frozen-lockfile

COPY /frontend/ .
RUN bun run build

FROM python-base

WORKDIR /app

# Install curl for health checks, libstdc++ and libgcc for Bun runtime
RUN apk --no-cache add curl bash libstdc++ libgcc

# Install Bun runtime (to /usr/local/bin so all users can access it)
RUN curl -fsSL https://bun.sh/install | bash \
    && mv /root/.bun/bin/bun /usr/local/bin/bun \
    && rm -rf /root/.bun

# Install SurrealDB binary (pinned v2.1.x)
ARG SURREALDB_VERSION=v2.1.4
RUN curl -fsSL https://install.surrealdb.com | sh -s -- --version ${SURREALDB_VERSION} \
    && mv /root/.surrealdb/surreal /usr/local/bin/surreal \
    && rm -rf /root/.surrealdb

ENV LOG_FILE_PATH=/app/logs/app.log
RUN mkdir /app/logs

# Create data directory for persistent SurrealDB storage
RUN mkdir /data

# Setup python
RUN pip install --upgrade pip --no-warn-script-location
COPY --from=requirements-stage /tmp/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --upgrade -r ./requirements.txt --no-warn-script-location

# Copy Python server code
COPY ./server ./server

# Copy built frontend SPA and Bun entry point + src/ modules
COPY --from=front-build /frontend/dist ./dist
COPY --from=front-build /frontend/bun-entry.ts ./bun-entry.ts
COPY --from=front-build /frontend/src ./src
COPY --from=front-build /frontend/node_modules ./node_modules
COPY --from=front-build /frontend/package.json ./package.json

# Set environment for production
ENV NODE_ENV=production

# Avoid running as root
RUN adduser -D myuser
RUN chown -R myuser:myuser /app /data
USER myuser

# Expose main port and SurrealDB storage volume
EXPOSE 8555/tcp
VOLUME /data

CMD ["bun", "run", "bun-entry.ts"]

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s \
    CMD curl --fail http://localhost:8555/health || exit 1
