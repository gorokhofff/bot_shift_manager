import aiosqlite
import os

# Путь к БД относительно папки app/ или bot/
DB_PATH = os.path.join(os.path.dirname(__file__), "../../data/shift_manager.db")

async def get_db_conn():
    db = await aiosqlite.connect(DB_PATH)
    # Включаем WAL для предотвращения блокировок при одновременной работе бота и API
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA busy_timeout=10000")
    db.row_factory = aiosqlite.Row
    return db

# Универсальные методы для пользователей
async def get_user_by_tid(telegram_id: int):
    async with await get_db_conn() as db:
        cursor = await db.execute('SELECT * FROM Users WHERE telegram_id = ?', (telegram_id,))
        return await cursor.fetchone()

async def get_all_active_users():
    async with await get_db_conn() as db:
        cursor = await db.execute("SELECT * FROM Users WHERE status = 'active'")
        return await cursor.fetchall()

# Универсальный метод для получения смен (используется и в боте, и в API)
async def get_shifts_paged(limit=25, offset=0):
    async with await get_db_conn() as db:
        query = '''
            SELECT s.*, u.name as user_name 
            FROM Shifts s 
            LEFT JOIN Users u ON s.user_id = u.id 
            ORDER BY s.start_time DESC LIMIT ? OFFSET ?
        '''
        cursor = await db.execute(query, (limit, offset))
        return await cursor.fetchall()