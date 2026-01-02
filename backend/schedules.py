import sqlite3
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, Dict, List
from .database import get_db

router = APIRouter()

# --- МОДЕЛИ ---
class GenerateRequest(BaseModel):
    user_id: int
    year: int
    month: int

class UserMonthlySetting(BaseModel):
    user_id: int
    year: int
    month: int
    start_time: str
    end_time: str

# --- ЭНДПОИНТЫ ---

@router.on_event("startup")
async def startup_ensure_tables():
    """Создаем таблицы при старте сервера, чтобы не блокировать запросы сохранения"""
    async with await get_db() as db:
        await db.execute('''
            CREATE TABLE IF NOT EXISTS user_monthly_settings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                year INTEGER NOT NULL,
                month INTEGER NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, year, month)
            )
        ''')
        await db.commit()

# Получение настроек времени для конкретного месяца
@router.get("/schedules/monthly-settings/{year}/{month}")
async def get_monthly_settings(year: int, month: int):
    async with await get_db() as db:
        cursor = await db.execute('''
            SELECT user_id, start_time, end_time 
            FROM user_monthly_settings 
            WHERE year = ? AND month = ?
        ''', (year, month))
        rows = await cursor.fetchall()
        
        settings = {}
        for row in rows:
            settings[row['user_id']] = {
                "start": row['start_time'],
                "end": row['end_time']
            }
        return settings

# Сохранение индивидуальной настройки (ИСПРАВЛЕН Network Error)
@router.post("/schedules/monthly-settings")
async def save_user_monthly_setting(data: UserMonthlySetting):
    async with await get_db() as db:
        try:
            # Upsert (Вставка или Обновление)
            await db.execute('''
                INSERT INTO user_monthly_settings (user_id, year, month, start_time, end_time, updated_at)
                VALUES (?, ?, ?, ?, ?, datetime('now'))
                ON CONFLICT(user_id, year, month) DO UPDATE SET
                start_time = excluded.start_time,
                end_time = excluded.end_time,
                updated_at = excluded.updated_at
            ''', (data.user_id, data.year, data.month, data.start_time, data.end_time))
            await db.commit()
            return {"status": "saved"}
        except Exception as e:
            await db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

# Получение списка пользователей, у которых есть данные (для фильтрации)
@router.get("/schedules/users-with-data")
async def get_users_with_data(year: int, month: int):
    async with await get_db() as db:
        ids = set()
        # 1. Из таблицы расписания
        c1 = await db.execute("SELECT DISTINCT user_id FROM employee_schedules WHERE year=? AND month=?", (year, month))
        for r in await c1.fetchall(): ids.add(r[0])
        # 2. Из настроек времени
        c2 = await db.execute("SELECT DISTINCT user_id FROM user_monthly_settings WHERE year=? AND month=?", (year, month))
        for r in await c2.fetchall(): ids.add(r[0])
        return list(ids)

# Удаление сотрудника из месяца (Кнопка Мусорка)
@router.delete("/employee-schedules/clear-month")
async def clear_user_month(user_id: int, year: int, month: int):
    async with await get_db() as db:
        try:
            # Удаляем график
            await db.execute("DELETE FROM employee_schedules WHERE user_id=? AND year=? AND month=?", (user_id, year, month))
            # Удаляем настройки времени
            await db.execute("DELETE FROM user_monthly_settings WHERE user_id=? AND year=? AND month=?", (user_id, year, month))
            await db.commit()
            return {"status": "deleted"}
        except Exception as e:
            await db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

# === НОВЫЙ МЕТОД ДЛЯ МАССОВОЙ ЗАГРУЗКИ (Матрица) ===
@router.get("/employee-schedules/matrix/{year}/{month}")
async def get_schedule_matrix(year: int, month: int):
    """Возвращает все записи расписания за месяц одним запросом (Optimized)"""
    async with await get_db() as db:
        cursor = await db.execute('''
            SELECT user_id, day, is_workday, notes 
            FROM employee_schedules 
            WHERE year = ? AND month = ?
        ''', (year, month))
        rows = await cursor.fetchall()
        
        # Формируем структуру { userId: { day: { ... } } }
        matrix = {}
        for row in rows:
            uid = row['user_id']
            if uid not in matrix: matrix[uid] = {}
            matrix[uid][row['day']] = {
                "is_workday": bool(row['is_workday']),
                "notes": row['notes']
            }
        return matrix

# Старый метод для получения одного пользователя (для совместимости)
@router.get("/employee-schedules/{user_id}/{year}/{month}")
async def get_schedule(user_id: int, year: int, month: int):
    async with await get_db() as db:
        cursor = await db.execute('''
            SELECT day, is_workday, notes 
            FROM employee_schedules 
            WHERE user_id = ? AND year = ? AND month = ?
        ''', (user_id, year, month))
        rows = await cursor.fetchall()
        
        schedule = {}
        for row in rows:
            schedule[row['day']] = {
                "is_workday": bool(row['is_workday']),
                "notes": row['notes']
            }
        return schedule

@router.put("/employee-schedules/{user_id}/{year}/{month}/{day}")
async def update_schedule(user_id: int, year: int, month: int, day: int, data: dict):
    async with await get_db() as db:
        try:
            await db.execute('''
                INSERT INTO employee_schedules (user_id, year, month, day, is_workday, notes, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
                ON CONFLICT(user_id, year, month, day) DO UPDATE SET
                is_workday = excluded.is_workday,
                notes = excluded.notes,
                updated_at = excluded.updated_at
            ''', (user_id, year, month, day, data.get('is_workday', False), data.get('notes', '')))
            await db.commit()
            return {"status": "success"}
        except Exception as e:
            await db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

@router.post("/employee-schedules/generate")
async def generate_schedule(req: GenerateRequest):
    # При добавлении сотрудника через "+" мы создаем дефолтную запись настроек, 
    # чтобы он появился в базе (users-with-data) и не исчез при обновлении страницы.
    async with await get_db() as db:
        try:
            await db.execute('''
                INSERT INTO user_monthly_settings (user_id, year, month, start_time, end_time, updated_at)
                VALUES (?, ?, ?, '12:00', '00:00', datetime('now'))
                ON CONFLICT(user_id, year, month) DO NOTHING
            ''', (req.user_id, req.year, req.month))
            await db.commit()
        except:
            pass 
    return {"status": "ready"}

@router.get("/schedules/actual-shifts")
async def get_actual_shifts_for_overlay(year: int, month: int, location: Optional[str] = None):
    async with await get_db() as db:
        month_str = f"{month:02d}"
        query = '''
            SELECT user_id, start_time, end_time, duration_hours 
            FROM Shifts 
            WHERE strftime('%Y', start_time) = ? 
            AND strftime('%m', start_time) = ?
        '''
        params = [str(year), month_str]
        if location:
            query += " AND location = ?"
            params.append(location)
            
        cursor = await db.execute(query, tuple(params))
        rows = await cursor.fetchall()
        
        result = {}
        for row in rows:
            try:
                uid = row['user_id']
                # Парсинг дня из строки 'YYYY-MM-DD HH:MM:SS'
                day = int(row['start_time'].split(' ')[0].split('-')[2])
                start_hm = row['start_time'].split(' ')[1][:5]
                end_hm = row['end_time'].split(' ')[1][:5] if row['end_time'] else "..."
                if uid not in result: result[uid] = {}
                # Если смен несколько, пока берем последнюю (упрощение)
                result[uid][day] = {
                    "start": start_hm,
                    "end": end_hm,
                    "duration": row['duration_hours'] or 0.0
                }
            except: continue
        return result