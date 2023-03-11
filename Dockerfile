FROM python:3.11-alpine AS requirements-stage

WORKDIR /tmp

RUN pip install poetry
COPY ./pyproject.toml ./poetry.lock* /tmp/
RUN poetry export -f requirements.txt --output requirements.txt --without-hashes

FROM node:14-alpine AS front-build

WORKDIR /frontend
COPY /frontend/package*.json ./
RUN npm install

COPY /frontend/ .
RUN npm run build

FROM python:3.11-alpine

WORKDIR /code

COPY --from=requirements-stage /tmp/requirements.txt /code/requirements.txt
COPY --from=front-build /frontend/dist /code/static

RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

COPY ./server /code

CMD ["python", "run.py"]