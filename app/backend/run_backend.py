"""
Executable entrypoint for bundling the FastAPI backend.
Runs uvicorn with settings driven by environment variables.
"""
import os
import pathlib
import uvicorn


def main():
    port = int(os.getenv("BACKEND_PORT", "8000"))
    host = os.getenv("BACKEND_HOST", "127.0.0.1")
    user_data = os.getenv("USER_DATA_DIR", os.getcwd())
    # Default SQLite location, can be overridden via DATABASE_URL
    sqlite_path = pathlib.Path(user_data) / "dispatcher.db"
    os.environ.setdefault("DATABASE_URL", f"sqlite+aiosqlite:///{sqlite_path}")

    uvicorn.run("main:app", host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
