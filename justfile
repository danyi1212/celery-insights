# Celery Insights — common commands
# Usage: just <recipe>

set dotenv-load := false

project := justfile_directory()
server := project / "server"
test_project := project / "test_project"

# Show available recipes
help:
    just --list

# ─── Check ────────────────────────────────────────────────────

# Run all checks (typecheck, lint, format, tests)
check-all: typecheck lint format test

# Run pre-commit hooks on all files
check:
    pre-commit run --all-files

# ─── Development ──────────────────────────────────────────────

# Start all dev services (SurrealDB + Python ingester + Vite)
dev:
    cd {{project}} && bun run dev

# Start only SurrealDB (port 8557)
dev-surreal:
    cd {{project}} && bun run dev:surreal

# Start only the Vite dev server (port 3000)
dev-all:
    cd {{project}} && bun dev:all

# Start only the Python ingester (port 8556)
dev-backend:
    cd {{server}} && python run.py

# ─── Build ────────────────────────────────────────────────────

# Build the Docker image
build:
    docker build -t celery-insights {{project}}

# ─── Test project (manual testing) ───────────────────────────

# Start the test docker-compose stack in the background
start:
    docker compose -f {{test_project}}/docker-compose.yml up --build -d

# Stop the test docker-compose stack
stop:
    docker compose -f {{test_project}}/docker-compose.yml down

# Start the test docker-compose stack in snapshot replay mode
# Usage: just start-debug /absolute/path/to/debug-bundle-v2.zip
start-debug bundle_path:
    DEBUG_BUNDLE_HOST_PATH='{{bundle_path}}' docker compose -f {{test_project}}/docker-compose.yml -f {{test_project}}/docker-compose.debug.yml up --build -d

# Rebuild and reload only the celery-insights service in the background
reload:
    docker compose -f {{test_project}}/docker-compose.yml up --build -d --no-deps celery-insights

# Show only Celery Insights logs from the test cluster
logs:
    docker compose -f {{test_project}}/docker-compose.yml logs -f celery-insights

# Start test cluster with the interactive producer (port 8000)
start-interactive: build
    docker compose -f {{test_project}}/docker-compose.yml --profile interactive up --build

# ─── Typecheck ────────────────────────────────────────────────

# Run all type checks (frontend + backend)
typecheck: typecheck-frontend typecheck-backend

# Type-check frontend (tsc)
typecheck-frontend:
    cd {{project}} && bun run typecheck

# Type-check backend (ty)
typecheck-backend:
    cd {{project}} && uv run ty check {{server}}/

# ─── Lint & Format ───────────────────────────────────────────

# Run all linters
lint: lint-frontend lint-backend

# Lint frontend (Oxlint)
lint-frontend:
    cd {{project}} && bun run lint

# Lint backend (Ruff)
lint-backend:
    cd {{project}} && uv run ruff check {{server}}/

# Fix frontend lint issues
lint-fix-frontend:
    cd {{project}} && bun run lint-fix

# Run all formatters (check mode)
format: format-frontend format-backend-check

# Check frontend formatting (Oxfmt)
format-frontend:
    cd {{project}} && bun run format

# Fix frontend formatting (Oxfmt)
format-fix-frontend:
    cd {{project}} && bun run format-fix

# Check backend formatting (Ruff)
format-backend-check:
    cd {{project}} && uv run ruff format --check {{server}}/

# Fix backend formatting (Ruff)
format-backend:
    cd {{project}} && uv run ruff format {{server}}/

# ─── Tests ────────────────────────────────────────────────────

# Run all unit tests (backend + frontend)
test: test-backend test-frontend

# Run backend tests
test-backend:
    cd {{project}} && uv run pytest

# Run frontend unit tests
test-frontend:
    cd {{project}} && bun run test

# Run frontend unit tests in watch mode
test-frontend-watch:
    cd {{project}} && bun run test:watch

# Run E2E tests (Playwright)
e2e:
    cd {{project}} && bun run e2e

# Run E2E tests with UI
e2e-ui:
    cd {{project}} && bun run e2e:ui

# Run E2E tests in headed mode
e2e-headed:
    cd {{project}} && bun run e2e:headed

# ─── Dependencies ─────────────────────────────────────────────

# Install all dependencies (frontend + backend)
install:
    install-frontend install-backend

# Install frontend dependencies
install-frontend:
    cd {{project}} && bun install

# Install backend dependencies
install-backend:
    cd {{project}} && uv sync
