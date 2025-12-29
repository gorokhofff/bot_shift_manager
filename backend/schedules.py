from typing import List, Optional
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from .database import get_db

router = APIRouter()

# --- МОДЕЛИ ---
class ScheduleToggle(BaseModel):
    user_id: int
    year: int
    month: int
    day: int
    is_workday: bool

class ScheduleBulkUpdate(BaseModel):
    updates: List[ScheduleToggle]

class CopyScheduleRequest(BaseModel):
    target_year: int
    target_month: int

class ScheduleGenerate(BaseModel):
    user_id: int
    year: int
    month: int

class ScheduleDayUpdate(BaseModel):
    is_workday: bool
    notes: Optional[str] = ""

# --- НОВЫЕ ЭНДПОИНТЫ (для EmployeeSchedules.jsx и ShiftSummary.jsx) ---

@router.get("/locations")
async def get_locations():
    """Получает список уникальных локаций из смен"""
    async with await get_db() as db:
        cursor = await db.execute("SELECT DISTINCT location FROM Shifts WHERE location IS NOT NULL AND location != ''")
        return [row['location'] for row in await cursor.fetchall()]

@router.get("/users-by-location/{location}")
async def get_users_by_location(location: str):
    """Возвращает пользователей, которые работали в указанной локации"""
    async with await get_db() as db:
        # Находим пользователей, у которых есть смены в этой локации
        cursor = await db.execute('''
            SELECT DISTINCT u.id, u.name, u.role, u.status 
            FROM Users u
            JOIN Shifts s ON u.id = s.user_id
            WHERE s.location = ? AND u.status = 'active'
        ''', (location,))
        return [dict(row) for row in await cursor.fetchall()]

@router.get("/employee-schedules/{user_id}/{year}/{month}")
async def get_employee_schedule_detail(user_id: int, year: int, month: int):
    """Получает детальный график конкретного сотрудника"""
    async with await get_db() as db:
        cursor = await db.execute('''
            SELECT day, is_workday, notes 
            FROM employee_schedules 
            WHERE user_id = ? AND year = ? AND month = ?
        ''', (user_id, year, month))
        
        schedule = {}
        for row in await cursor.fetchall():
            schedule[row['day']] = {
                "is_workday": bool(row['is_workday']),
                "notes": row['notes']
            }
        return schedule

@router.post("/employee-schedules/generate")
async def generate_basic_schedule(data: ScheduleGenerate):
    """Генерирует базовое расписание (все дни рабочие)"""
    async with await get_db() as db:
        try:
            # Дней в месяце (упрощенно 31, лишние не помешают)
            for day in range(1, 32):
                await db.execute('''
                    INSERT INTO employee_schedules (user_id, year, month, day, is_workday)
                    VALUES (?, ?, ?, ?, 1)
                    ON CONFLICT(user_id, year, month, day) DO NOTHING
                ''', (data.user_id, data.year, data.month, day))
            await db.commit()
            return {"status": "success"}
        except Exception as e:
            await db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

@router.put("/employee-schedules/{user_id}/{year}/{month}/{day}")
async def update_employee_schedule_day(user_id: int, year: int, month: int, day: int, data: ScheduleDayUpdate):
    """Обновляет конкретный день в графике"""
    async with await get_db() as db:
        try:
            await db.execute('''
                INSERT INTO employee_schedules (user_id, year, month, day, is_workday, notes)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(user_id, year, month, day) DO UPDATE SET
                is_workday = excluded.is_workday,
                notes = excluded.notes
            ''', (user_id, year, month, day, data.is_workday, data.notes))
            await db.commit()
            return {"status": "success"}
        except Exception as e:
            await db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

# --- СТАРЫЕ ЭНДПОИНТЫ (для совместимости с SimpleScheduler, если используется) ---

@router.get("/schedules/{year}/{month}")
async def get_monthly_schedule(year: int, month: int):
    async with await get_db() as db:
        users_cursor = await db.execute("SELECT id, name, role FROM Users WHERE status = 'active' ORDER BY role, name")
        users = [dict(row) for row in await users_cursor.fetchall()]
        
        for user in users:
            loc_cursor = await db.execute('''
                SELECT location, COUNT(*) as cnt FROM Shifts 
                WHERE user_id = ? GROUP BY location ORDER BY cnt DESC LIMIT 1
            ''', (user['id'],))
            loc_row = await loc_cursor.fetchone()
            user['location'] = loc_row['location'] if loc_row else 'all'

        sched_cursor = await db.execute(
            "SELECT user_id, day, is_workday FROM employee_schedules WHERE year = ? AND month = ?",
            (year, month)
        )
        
        schedule_map = {}
        for row in await sched_cursor.fetchall():
            if row['user_id'] not in schedule_map: schedule_map[row['user_id']] = {}
            schedule_map[row['user_id']][row['day']] = bool(row['is_workday'])
            
        return {"users": users, "schedules": schedule_map}

@router.post("/schedules/toggle")
async def toggle_day(data: ScheduleToggle):
    async with await get_db() as db:
        await db.execute('''
            INSERT INTO employee_schedules (user_id, year, month, day, is_workday)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(user_id, year, month, day) DO UPDATE SET
            is_workday = excluded.is_workday
        ''', (data.user_id, data.year, data.month, data.day, data.is_workday))
        await db.commit()
        return {"status": "updated"}

@router.post("/schedules/bulk-update")
async def bulk_update_schedules(payload: ScheduleBulkUpdate):
    async with await get_db() as db:
        try:
            for item in payload.updates:
                await db.execute('''
                    INSERT INTO employee_schedules (user_id, year, month, day, is_workday)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(user_id, year, month, day) DO UPDATE SET
                    is_workday = excluded.is_workday
                ''', (item.user_id, item.year, item.month, item.day, item.is_workday))
            await db.commit()
            return {"status": "success", "count": len(payload.updates)}
        except Exception as e:
            await db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

@router.post("/schedules/copy-prev")
async def copy_previous_month_schedule(data: CopyScheduleRequest):
    async with await get_db() as db:
        prev_month = data.target_month - 1
        prev_year = data.target_year
        if prev_month == 0:
            prev_month = 12
            prev_year -= 1
            
        await db.execute("DELETE FROM employee_schedules WHERE year = ? AND month = ?", (data.target_year, data.target_month))
        await db.execute('''
            INSERT INTO employee_schedules (user_id, year, month, day, is_workday)
            SELECT user_id, ?, ?, day, is_workday
            FROM employee_schedules 
            WHERE year = ? AND month = ?
        ''', (data.target_year, data.target_month, prev_year, prev_month))
        await db.commit()
        return {"status": "copied"}