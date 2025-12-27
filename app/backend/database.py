globals()["sync_engine"] = sync_engine
globals()["Base"] = Base
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
import os
import pathlib
import models


def _default_sqlite_url():
    # Use app data dir if provided (Electron passes USER_DATA_DIR), else current dir.
    user_data_dir = os.getenv("USER_DATA_DIR", os.getcwd())
    db_path = pathlib.Path(user_data_dir) / "dispatcher.db"
    return f"sqlite+aiosqlite:///{db_path}"


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    os.getenv("SQLITE_URL", _default_sqlite_url()),
)

engine = create_async_engine(DATABASE_URL, echo=True)
SessionLocal = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)  # type: ignore

if DATABASE_URL.startswith("sqlite+aiosqlite:///"):
    SYNC_DATABASE_URL = DATABASE_URL.replace("+aiosqlite", "")
else:
    SYNC_DATABASE_URL = DATABASE_URL.replace("+asyncpg", "")

sync_engine = create_engine(SYNC_DATABASE_URL)
Base = models.Base
globals()["sync_engine"] = sync_engine
globals()["Base"] = Base


# Add get_db for FastAPI dependency
async def get_db():
    session = SessionLocal()
    try:
        yield session
    finally:
        await session.close()
