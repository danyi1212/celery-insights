FROM python:3.12-alpine AS python-base

ENV PYTHONFAULTHANDLER=1 \
    PYTHONHASHSEED=random \
    PYTHONUNBUFFERED=1

RUN pip install --upgrade pip

FROM python-base AS requirements-stage

WORKDIR /tmp

# Setup python
RUN pip install --upgrade pip
RUN pip install poetry poetry-plugin-export

COPY ./pyproject.toml ./poetry.lock* /tmp/

ARG VARIANT=regular
RUN if [ $VARIANT = "all" ]; then \
        poetry export -f requirements.txt --output requirements.txt --with all; \
    else \
        poetry export -f requirements.txt --output requirements.txt; \
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

ENV LOG_FILE_PATH=/app/logs/app.log
RUN mkdir /app/logs

# Setup python
RUN pip install --upgrade pip --no-warn-script-location
COPY --from=requirements-stage /tmp/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --upgrade -r ./requirements.txt --no-warn-script-location

# Copy Python server code
COPY ./server ./server

# Copy built frontend SPA and Bun entry point
COPY --from=front-build /frontend/dist ./dist
COPY --from=front-build /frontend/bun-entry.ts ./bun-entry.ts

# Set environment for production
ENV NODE_ENV=production

# Avoid running as root
RUN adduser -D myuser
RUN chown -R myuser:myuser /app
USER myuser

EXPOSE 8555/tcp
CMD ["bun", "run", "bun-entry.ts"]

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s \
    CMD curl --fail http://localhost:8555/health || exit 1
