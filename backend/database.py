import os
import aiosqlite
from dotenv import load_dotenv

load_dotenv()

# 1. Получаем абсолютный путь к папке, где лежит этот скрипт (backend/)
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))

# 2. Поднимаемся на уровень выше в корень проекта
PROJECT_ROOT = os.path.dirname(CURRENT_DIR)

# 3. Жестко задаем путь к БД в папке data в КОРНЕ проекта.
# Мы НЕ используем os.getenv("DATABASE_URL"), чтобы избежать ошибки с точкой (.)
DB_NAME = os.path.join(PROJECT_ROOT, "data", "shift_manager.db")

print(f"✅ DATABASE CONNECTED TO: {DB_NAME}")

class DbSession:
    def __init__(self, db_path):
        self.db_path = db_path
        self.db = None

    async def __aenter__(self):
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        self.db = await aiosqlite.connect(self.db_path, timeout=30.0)
        await self.db.execute("PRAGMA journal_mode=WAL")
        self.db.row_factory = aiosqlite.Row
        return self.db

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.db:
            await self.db.close()

async def get_db():
    return DbSession(DB_NAME)