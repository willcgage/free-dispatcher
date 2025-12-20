# FastAPI backend for Train Dispatcher App

FROM python:3.13.1-slim-bullseye

# Always pull the latest base image to ensure vulnerabilities are patched
RUN apt-get update && apt-get upgrade -y && apt-get dist-upgrade -y && apt-get clean

WORKDIR /app

COPY backend/requirements.txt ./requirements.txt
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends \
    gcc build-essential python3-dev && \
    pip install --no-cache-dir -r requirements.txt && \
    apt-get purge -y --auto-remove gcc build-essential python3-dev && \
    rm -rf /var/lib/apt/lists/*

COPY . .
COPY ../alembic.ini /app/
COPY ../alembic /app/alembic/

# Set PYTHONPATH so backend modules are found
ENV PYTHONPATH=/app/backend

# Default: run FastAPI from backend directory
WORKDIR /app/backend
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
