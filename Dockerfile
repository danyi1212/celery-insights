FROM python:3.11-alpine AS requirements-stage

WORKDIR /tmp

# Setup python
RUN pip install --upgrade pip
RUN pip install poetry
RUN poetry self add poetry-plugin-export

COPY ./pyproject.toml ./poetry.lock* /tmp/

ARG VARIANT=regular
RUN if [ $VARIANT = "all" ]; then \
        poetry export -f requirements.txt --output requirements.txt --with full; \
    else \
        poetry export -f requirements.txt --output requirements.txt; \
    fi

FROM node:18-alpine AS front-build

WORKDIR /frontend

RUN mkdir -p /opt/node_modules
COPY /frontend/package*.json ./
RUN npm ci

COPY /frontend/ .
RUN npm run build

FROM python:3.11-alpine

WORKDIR /app

# For health check
RUN apk --no-cache add curl

ENV LOG_FILE_PATH=/app/logs/app.log
RUN mkdir /app/logs

# Avoid running as root
RUN adduser -D myuser
RUN chown myuser:myuser /app/logs
USER myuser

# Setup python
RUN pip install --upgrade pip --no-warn-script-location
COPY --from=requirements-stage /tmp/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --upgrade -r ./requirements.txt --no-warn-script-location
COPY ./server ./

# Copy front static files
COPY --from=front-build /frontend/dist ./static

EXPOSE 8555/tcp
CMD ["python", "run.py"]

HEALTHCHECK --timeout=3s CMD curl --fail http://localhost:8555/health || exit 1
