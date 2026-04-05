.PHONY: install serve start stop test lint format build clean

install:
	@poetry shell
	@poetry install

serve:
	@poetry run uvicorn iten_forge.server:app --reload --port 8000 --env-file .env

start:
	@docker compose up -d --build

stop:
	@docker compose down

test:
	@poetry run pytest -v

lint:
	@poetry run ruff check .

format:
	@poetry run ruff format .

build:
	@docker compose build

clean:
	@docker compose down
	@find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
