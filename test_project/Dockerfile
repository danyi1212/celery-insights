FROM python:3.12-alpine AS base

ENV PYTHONFAULTHANDLER=1 \
    PYTHONHASHSEED=random \
    PYTHONUNBUFFERED=1

FROM base AS build

WORKDIR /tmp

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
COPY pyproject.toml uv.lock* /tmp/

RUN uv export --no-hashes --frozen --no-emit-project -o requirements.txt

FROM base

WORKDIR /app

RUN pip install --upgrade pip --no-warn-script-location
COPY --from=build /tmp/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --upgrade -r ./requirements.txt --no-warn-script-location

COPY . .

ENV PYTHONPATH=/app
