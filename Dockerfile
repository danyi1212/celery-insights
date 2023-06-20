FROM python:3.11-alpine AS requirements-stage

WORKDIR /tmp

# Setup python
RUN pip install --upgrade pip
RUN pip install poetry

COPY ./pyproject.toml ./poetry.lock* /tmp/
RUN poetry export -f requirements.txt --output requirements.txt --without-hashes

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

# Setup python
RUN pip install --upgrade pip
COPY --from=requirements-stage /tmp/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --upgrade -r ./requirements.txt
COPY ./server ./

# Copy front static files
COPY --from=front-build /frontend/dist ./static

EXPOSE 8555/tcp
CMD ["python", "run.py"]

HEALTHCHECK --timeout=3s CMD curl --fail http://localhost:8555/health || exit 1
