# Train Dispatcher Backend

This is a FastAPI backend service for the Train Dispatcher application.

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
