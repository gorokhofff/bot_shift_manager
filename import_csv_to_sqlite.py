import aiosqlite
import asyncio
import csv
import os

DB_PATH = 'shift_manager.db'  # Путь к базе
USERS_CSV = 'users.csv'        # Путь к users.csv
SHIFTS_CSV = 'shifts.csv'      # Путь к shifts.csv

async def import_users(db):
    if not os.path.exists(USERS_CSV):
        print(f"Файл {USERS_CSV} не найден.")
        return

    print("Импортируем пользователей...")

    async with db.execute('DELETE FROM Users') as _:
        await db.commit()

    with open(USERS_CSV, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            telegram_id = row.get('telegram_id') or None  # <-- Если нет, будет NULL
            await db.execute(
                'INSERT INTO Users (id, telegram_id, name, status) VALUES (?, ?, ?, ?)',
                (row['id'], telegram_id, row['name'], row['status'])
            )
    await db.commit()
    print("✅ Пользователи импортированы.")


async def import_shifts(db):
    if not os.path.exists(SHIFTS_CSV):
        print(f"Файл {SHIFTS_CSV} не найден.")
        return

    print("Импортируем смены...")

    async with db.execute('DELETE FROM Shifts') as _:
        await db.commit()

    with open(SHIFTS_CSV, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            await db.execute(
                '''INSERT INTO Shifts (user_id, start_time, end_time, location, duration_hours, shift_date)
                   VALUES (?, ?, ?, ?, ?, ?)''',
                (
                    row['user_id'],
                    row['start_time'],
                    row['end_time'],
                    row['location'],
                    row.get('duration_hours'),
                    row.get('shift_date')
                )
            )
    await db.commit()
    print("✅ Смены импортированы.")


async def main():
    async with aiosqlite.connect(DB_PATH) as db:
        await import_users(db)
        await import_shifts(db)

if __name__ == "__main__":
    asyncio.run(main())
