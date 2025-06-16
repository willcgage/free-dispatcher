# Train Dispatcher Backend

This is a FastAPI backend service for the Train Dispatcher application.

## LAN Access & Docker Compose
- For cross-platform LAN access, see the main project README and `docker-compose.yml`.
- On macOS, use `../scripts/run-with-lan.sh` to enable LAN access via socat.
- On Linux/Windows, LAN access works out of the box with Docker Compose.

## Development

1. Install dependencies:
   ```sh
   pip install -r requirements.txt
   ```
2. Run the server:
   ```sh
   uvicorn main:app --reload
   ```

## Docker

To build and run the backend in Docker:

```sh
docker build -t train-dispatcher-backend .
docker run -p 8000:8000 train-dispatcher-backend
```

The API will be available at http://localhost:8000

See the main project README for LAN access and platform-specific details.
