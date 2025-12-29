import os
import aiosqlite
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_NAME = os.getenv("DATABASE_URL", os.path.join(BASE_DIR, "data", "shift_manager.db"))

class DbSession:
    def __init__(self, db_path):
        self.db_path = db_path
        self.db = None

    async def __aenter__(self):
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self.db = await aiosqlite.connect(self.db_path, timeout=30.0)
        await self.db.execute("PRAGMA journal_mode=WAL")
        await self.db.execute("PRAGMA busy_timeout=10000")
        self.db.row_factory = aiosqlite.Row
        return self.db

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.db:
            await self.db.close()

async def get_db():
    return DbSession(DB_NAME)