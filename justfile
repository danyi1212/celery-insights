# Celery Insights — common commands
# Usage: just <recipe>

set dotenv-load := false

project := justfile_directory()
frontend := project / "frontend"
server := project / "server"
test_project := project / "test_project"

# ─── Development ──────────────────────────────────────────────

# Start all dev services (SurrealDB + Python ingester + Vite)
dev:
    cd {{frontend}} && bun run dev:all

# Start only SurrealDB (port 8557)
dev-surreal:
    cd {{frontend}} && bun run dev:surreal

# Start only the Vite dev server (port 3000)
dev-frontend:
    cd {{frontend}} && bun dev

# Start only the Python ingester (port 8556)
dev-backend:
    cd {{server}} && python run.py

# ─── Build ────────────────────────────────────────────────────

# Build the frontend SPA
build-frontend:
    cd {{frontend}} && bun run build

# Build the Docker image
build-docker:
    docker build -t celery-insights {{project}}

# ─── Test project (manual testing) ───────────────────────────

# Start test cluster without rebuilding the main image (uses cached)
start-test:
    docker compose -f {{test_project}}/docker-compose.yml up --build

# Start test cluster in the background
start-test-detached: build-docker
    docker compose -f {{test_project}}/docker-compose.yml up --build -d

# Stop the test cluster
stop-test:
    docker compose -f {{test_project}}/docker-compose.yml down -v --remove-orphans

# Show test cluster logs
logs-test:
    docker compose -f {{test_project}}/docker-compose.yml logs -f

# Show only Celery Insights logs from the test cluster
logs-insights:
    docker compose -f {{test_project}}/docker-compose.yml logs -f celery-insights

# Start test cluster with the interactive producer (port 8000)
start-test-interactive: build-docker
    docker compose -f {{test_project}}/docker-compose.yml --profile interactive up --build

# ─── Lint & Format ───────────────────────────────────────────

# Run all linters
lint: lint-frontend lint-backend

# Lint frontend (ESLint)
lint-frontend:
    cd {{frontend}} && bun run lint

# Lint backend (Ruff)
lint-backend:
    cd {{project}} && uv run ruff check {{server}}/

# Fix frontend lint issues
lint-fix-frontend:
    cd {{frontend}} && bun run lint-fix

# Format backend (Ruff)
format-backend:
    cd {{project}} && uv run ruff format {{server}}/

# Type-check backend
typecheck-backend:
    cd {{project}} && uv run ty check {{server}}/

# ─── Tests ────────────────────────────────────────────────────

# Run all unit tests (backend + frontend)
test: test-backend test-frontend

# Run backend tests
test-backend:
    cd {{project}} && uv run pytest

# Run frontend unit tests
test-frontend:
    cd {{frontend}} && bun run test

# Run frontend unit tests in watch mode
test-frontend-watch:
    cd {{frontend}} && bun run test:watch

# Run E2E tests (Playwright)
e2e:
    cd {{frontend}} && bun run e2e

# Run E2E tests with UI
e2e-ui:
    cd {{frontend}} && bun run e2e:ui

# Run E2E tests in headed mode
e2e-headed:
    cd {{frontend}} && bun run e2e:headed

# ─── Dependencies ─────────────────────────────────────────────

# Install all dependencies (frontend + backend)
install:
    cd {{frontend}} && bun install
    cd {{project}} && uv sync

# Install frontend dependencies
install-frontend:
    cd {{frontend}} && bun install

# Install backend dependencies
install-backend:
    cd {{project}} && uv sync
