.PHONY: install serve start down test lint format build tunnel clean

install:
	@poetry shell
	@poetry install

serve:
	@poetry run uvicorn iten_forge.server:app --reload --port 8000 --env-file .env

start:
	@docker compose up -d --build

down:
	@docker compose down

test:
	@poetry run pytest -v

lint:
	@poetry run ruff check .

format:
	@poetry run ruff format .

build:
	@docker compose build

tunnel:
	@ngrok http 8000

clean:
	@docker compose down -v
	@find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
