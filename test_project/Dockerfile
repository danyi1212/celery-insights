# syntax=docker/dockerfile:1.7
FROM python:3.12-alpine AS base

ENV PYTHONFAULTHANDLER=1 \
    PYTHONHASHSEED=random \
    PYTHONUNBUFFERED=1

FROM base AS build

WORKDIR /tmp

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY pyproject.toml uv.lock* /tmp/

RUN uv export --no-hashes --frozen --no-emit-project -o requirements.txt

FROM base AS deps

WORKDIR /tmp

# Build-time toolchain for native Python deps (e.g. surrealdb via Rust/maturin)
RUN apk --no-cache add build-base cargo rust

COPY --from=build /tmp/requirements.txt ./requirements.txt
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade --prefix=/install -r ./requirements.txt --no-warn-script-location

FROM base

WORKDIR /app

RUN apk --no-cache add libstdc++ libgcc
COPY --from=deps /install /usr/local

COPY . .

ENV PYTHONPATH=/app
