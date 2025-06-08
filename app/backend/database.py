from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
import os
import models

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/dispatcher_db")

engine = create_async_engine(DATABASE_URL, echo=True)
SessionLocal = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)  # type: ignore

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
