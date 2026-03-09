FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

FROM base AS deps

RUN pip install --no-cache-dir poetry==1.8.5 && \
    poetry config virtualenvs.create false

COPY pyproject.toml poetry.lock ./
RUN poetry install --no-interaction --no-ansi --only main

FROM base AS runtime

COPY --from=deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=deps /usr/local/bin/uvicorn /usr/local/bin/uvicorn

COPY iten_forge/ ./iten_forge/

EXPOSE 8000

CMD ["uvicorn", "iten_forge.server:app", "--host", "0.0.0.0", "--port", "8000"]
