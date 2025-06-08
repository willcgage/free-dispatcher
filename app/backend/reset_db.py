from sqlalchemy import create_engine
from database import models, DATABASE_URL

# Remove async driver for sync engine
sync_url = DATABASE_URL.replace("+asyncpg", "")
engine = create_engine(sync_url)
Base = models.Base

print("Dropping all tables...")
Base.metadata.drop_all(bind=engine)
print("Creating all tables...")
Base.metadata.create_all(bind=engine)
print("Done.")
