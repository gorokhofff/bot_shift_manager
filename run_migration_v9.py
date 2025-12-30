import asyncio
import aiosqlite
import os

# Определяем пути
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data", "shift_manager.db")

async def run_migration():
    if not os.path.exists(DB_PATH):
        print(f"❌ Ошибка: База данных не найдена по пути: {DB_PATH}")
        return

    print(f"📂 Подключение к базе данных: {DB_PATH}")

    async with aiosqlite.connect(DB_PATH) as db:
        try:
            # 1. Создаем таблицу LocationRoleSettings
            print("🛠  Создание таблицы LocationRoleSettings...")
            await db.execute('''
                CREATE TABLE IF NOT EXISTS LocationRoleSettings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    location TEXT NOT NULL,
                    role TEXT NOT NULL,
                    default_start_time TEXT DEFAULT '12:00',
                    default_end_time TEXT DEFAULT '00:00',
                    UNIQUE(location, role)
                );
            ''')
            print("✅ Таблица LocationRoleSettings готова.")

            # 2. (Опционально) Добавляем базовые настройки для примера, если таблица пуста
            cursor = await db.execute("SELECT COUNT(*) FROM LocationRoleSettings")
            count = (await cursor.fetchone())[0]
            
            if count == 0:
                print("📥 Добавление начальных настроек (пример)...")
                # Примерные дефолтные значения
                defaults = [
                    ('Yenibosna', 'hookah', '12:00', '00:00'),
                    ('Yenibosna', 'barman', '11:00', '23:00'),
                    ('Yenibosna', 'waiter', '10:00', '22:00'),
                    ('Göktürk', 'hookah', '13:00', '01:00'),
                    ('Göktürk', 'barman', '12:00', '00:00'),
                ]
                await db.executemany('''
                    INSERT OR IGNORE INTO LocationRoleSettings (location, role, default_start_time, default_end_time)
                    VALUES (?, ?, ?, ?)
                ''', defaults)
                print(f"✅ Добавлено {len(defaults)} настроек по умолчанию.")
            
            await db.commit()
            print("🎉 Миграция v9 успешно завершена!")

        except Exception as e:
            print(f"❌ Ошибка при выполнении миграции: {e}")
            await db.rollback()

if __name__ == "__main__":
    try:
        asyncio.run(run_migration())
    except KeyboardInterrupt:
        print("\n🚫 Миграция прервана пользователем.")