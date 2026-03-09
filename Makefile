.PHONY: install dev down test lint format build clean

install:
	poetry install

start:
	docker compose up --build

down:
	docker compose down

test:
	poetry run pytest -v

lint:
	poetry run ruff check .

format:
	poetry run ruff format .

build:
	docker compose build

clean:
	docker compose down -v
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
