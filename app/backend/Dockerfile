# FastAPI backend for Train Dispatcher App

FROM python:3.12-slim-bookworm

# Ensure all system packages are up-to-date and security patches are applied
RUN apt-get update && apt-get upgrade -y && apt-get dist-upgrade -y && apt-get clean

WORKDIR /app

COPY requirements.txt ./
RUN apt-get update && apt-get upgrade -y && apt-get install -y --no-install-recommends gcc && \
	pip install --no-cache-dir -r requirements.txt && \
	apt-get purge -y --auto-remove gcc && \
	rm -rf /var/lib/apt/lists/*

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
