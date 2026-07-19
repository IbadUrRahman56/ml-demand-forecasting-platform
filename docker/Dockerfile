FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (better Docker layer caching — only reinstalls
# when requirements.txt actually changes, not on every code edit)
COPY api/requirements.txt api/requirements.txt
RUN pip install --no-cache-dir -r api/requirements.txt

# Preserve the same api/app/data/models layout as local dev, since main.py's
# BASE_DIR is computed relative to its own file location (3 levels up).
COPY api ./api
COPY data ./data
COPY models ./models

WORKDIR /app/api
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
