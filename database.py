import aiosqlite
import pytz
from datetime import datetime

DB_NAME = "shift_manager.db"

async def init_db():
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute('''
        CREATE TABLE IF NOT EXISTS Users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id INTEGER UNIQUE,
            name TEXT,
            status TEXT
        )
        ''')
        await db.execute('''
        CREATE TABLE IF NOT EXISTS Shifts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            start_time TEXT,
            end_time TEXT,
            location TEXT,
            duration_hours REAL,
            shift_date TEXT,
            FOREIGN KEY(user_id) REFERENCES Users(id)
        )
        ''')
        await db.execute('''
        CREATE TABLE IF NOT EXISTS Reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shift_id INTEGER,
            report_text TEXT,
            created_at TEXT,
            FOREIGN KEY(shift_id) REFERENCES Shifts(id)
        )
        ''')
        await db.commit()

# --- USERS ---

async def get_user(telegram_id):
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute('SELECT * FROM Users WHERE telegram_id = ?', (telegram_id,))
        return await cursor.fetchone()

async def add_user(telegram_id, name, status='pending'):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute(
            'INSERT INTO Users (telegram_id, name, status) VALUES (?, ?, ?)',
            (telegram_id, name, status)
        )
        await db.commit()

async def activate_user(telegram_id):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute(
            'UPDATE Users SET status = ? WHERE telegram_id = ?',
            ('active', telegram_id)
        )
        await db.commit()

async def get_all_users():
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute('SELECT telegram_id, status FROM Users')
        return await cursor.fetchall()
    
    

# --- SHIFTS ---

async def start_shift(user_id, location, start_time):
    if not start_time:
        print(f"[start_shift] HATA: start_time eksik! user_id={user_id}, location={location}")
        return

    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute(
            'INSERT INTO Shifts (user_id, start_time, location) VALUES (?, ?, ?)',
            (user_id, start_time, location)
        )
        await db.commit()

        print(f"[start_shift] Vardiya başlatıldı: user_id={user_id}, time={start_time}, location={location}")

async def end_shift(user_id, end_time):
    async with aiosqlite.connect(DB_NAME) as db:
        async with db.execute(
            'SELECT id, start_time FROM Shifts WHERE user_id = ? AND end_time IS NULL',
            (user_id,)
        ) as cursor:
            row = await cursor.fetchone()

        if row:
            shift_id, start_time_str = row

            if start_time_str is None:
                print(f"[end_shift] HАТА: start_time is None (user_id={user_id})")
                return

            try:
                # Добавляем explicit timezone handling
                start_dt = datetime.strptime(start_time_str, "%Y-%m-%d %H:%M:%S")
                end_dt = datetime.strptime(end_time, "%Y-%m-%d %H:%M:%S")
                
                # Принудительно указываем, что время уже в Istanbul timezone
                istanbul_tz = pytz.timezone("Europe/Istanbul")
                start_dt = istanbul_tz.localize(start_dt)
                end_dt = istanbul_tz.localize(end_dt)
                
                duration_hours = max(0.1, round((end_dt - start_dt).total_seconds() / 3600, 1))
                shift_date = start_dt.date().isoformat()

                await db.execute('''
                    UPDATE Shifts
                    SET end_time = ?, duration_hours = ?, shift_date = ?
                    WHERE id = ?
                ''', (end_time, duration_hours, shift_date, shift_id))
                await db.commit()

                print(f"[end_shift] Vardiya güncellendi: user_id={user_id}, shift_id={shift_id}, saat={duration_hours}")
            except Exception as e:
                print(f"[end_shift] HАТА: strptime veya hesaplama hatası (user_id={user_id}): {e}")
        else:
            print(f"[end_shift] Aktif vardiya bulunamadı (user_id={user_id})")

async def get_active_shift(user_id):
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute(
            'SELECT * FROM Shifts WHERE user_id = ? AND end_time IS NULL',
            (user_id,)
        )
        return await cursor.fetchone()

# --- REPORTS ---

async def add_report(shift_id, report_text, created_at):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute(
            'INSERT INTO Reports (shift_id, report_text, created_at) VALUES (?, ?, ?)',
            (shift_id, report_text, created_at)
        )
        await db.commit()

async def get_today_report(user_id, date_str):
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute('''
            SELECT Reports.* FROM Reports
            JOIN Shifts ON Reports.shift_id = Shifts.id
            WHERE Shifts.user_id = ? AND DATE(Reports.created_at) = ?
        ''', (user_id, date_str))
        return await cursor.fetchone()

async def update_report(report_id, new_text, new_time):
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute(
            "UPDATE Reports SET report_text = ?, created_at = ? WHERE id = ?",
            (new_text, new_time, report_id)
        )
        await db.commit()

