from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context
import sys
import os

# Ensure Alembic always runs inside Docker
if os.environ.get("RUNNING_IN_DOCKER") != "1":
    raise RuntimeError("Alembic migrations must be run inside the Docker container. Set RUNNING_IN_DOCKER=1 in your Dockerfile or docker-compose.")

# Add the backend directory to the system path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.models import Base  # Import Base for target_metadata


# Alembic config and logging setup
config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata  # Set target_metadata for autogenerate


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an engine, though an engine is
    still required to be present in the config.
    """
    url = config.get_main_option("sqlalchemy.url")
    print(f"[ALEMBIC DEBUG] Running migrations offline with URL: {url}")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.
    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()