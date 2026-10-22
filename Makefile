.PHONY: install check check-js check-python dev-web dev-api dev-agent supabase-start supabase-reset supabase-status

install:
	pnpm install
	uv sync --all-packages --dev

check: check-js check-python

check-js:
	pnpm format:check
	pnpm typecheck
	pnpm lint
	pnpm test
	pnpm build

check-python:
	uv run --project apps/agent-runtime ruff format --check apps/agent-runtime
	uv run --project apps/agent-runtime ruff check apps/agent-runtime
	uv run --project apps/agent-runtime pytest apps/agent-runtime/tests

dev-web:
	pnpm dev:web

dev-api:
	pnpm dev:api

dev-agent:
	pnpm dev:agent

supabase-start:
	npx supabase start

supabase-reset:
	npx supabase db reset

supabase-status:
	npx supabase status
