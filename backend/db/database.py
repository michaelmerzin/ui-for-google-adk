from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from core.config import settings

engine = create_async_engine(settings.DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session


async def init_db() -> None:
    """Create all tables and seed a default admin user."""
    from db import models  # noqa: F401 — ensure models are registered

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed admin if no users exist
    from sqlalchemy import select
    from core.security import hash_password

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(models.User))
        if not result.scalars().first():
            admin = models.User(
                username="admin",
                hashed_password=hash_password("admin123"),
                role="admin",
                is_active=True,
            )
            session.add(admin)
            await session.commit()
