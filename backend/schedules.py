from typing import List, Optional
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from datetime import datetime, timedelta
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

class LocationSettingModel(BaseModel):
    location: str
    default_start_time: str
    default_end_time: str

class RoleScheduleSetting(BaseModel):
    location: str
    role: str
    default_start_time: str
    default_end_time: str

class RoleSettingsUpdate(BaseModel):
    settings: List[RoleScheduleSetting]

# --- НОВЫЕ ЭНДПОИНТЫ (для EmployeeSchedules.jsx и ShiftSummary.jsx) ---

@router.get("/locations")
async def get_locations():
    """Получает список уникальных локаций из смен"""
    async with await get_db() as db:
        cursor = await db.execute("SELECT DISTINCT location FROM Shifts WHERE location IS NOT NULL AND location != ''")
        return [row['location'] for row in await cursor.fetchall()]
    
@router.get("/dashboard/daily-status")
async def get_daily_status():
    """
    Возвращает сводку на сегодня: Active + Scheduled Missing
    """
    today = datetime.now()
    # Получаем расписание на сегодня
    async with await get_db() as db:
        # 1. Активные сотрудники
        users_cursor = await db.execute("SELECT id, name, role FROM Users WHERE status = 'active'")
        users = {u['id']: dict(u) for u in await users_cursor.fetchall()}

        # 2. План на сегодня
        schedule_cursor = await db.execute('''
            SELECT user_id, is_workday 
            FROM employee_schedules 
            WHERE year = ? AND month = ? AND day = ?
        ''', (today.year, today.month, today.day))
        
        scheduled_ids = {row['user_id'] for row in await schedule_cursor.fetchall() if row['is_workday']}

        # 3. Активные смены (кто сейчас работает)
        shifts_cursor = await db.execute('''
            SELECT s.*, u.name as user_name, u.role 
            FROM Shifts s 
            JOIN Users u ON s.user_id = u.id 
            WHERE s.end_time IS NULL
        ''')
        active_shifts = [dict(row) for row in await shifts_cursor.fetchall()]
        active_ids = {s['user_id'] for s in active_shifts}

        # 4. Локации по умолчанию (для отсутствующих)
        loc_cursor = await db.execute("SELECT user_id, location, COUNT(*) as c FROM Shifts GROUP BY user_id, location ORDER BY c DESC")
        user_locs = {}
        for row in await loc_cursor.fetchall():
            if row['user_id'] not in user_locs: user_locs[row['user_id']] = row['location']

        result = {"Yenibosna": [], "Göktürk": [], "Unknown": []}

        # А. Добавляем тех, кто работает
        for shift in active_shifts:
            loc = shift['location'] if shift['location'] in result else "Unknown"
            status = "working_extra" if shift['user_id'] not in scheduled_ids else "working"
            
            result[loc].append({
                "user_id": shift['user_id'],
                "name": shift['user_name'],
                "role": shift['role'],
                "status": status,
                "shift": shift
            })

        # Б. Добавляем "прогульщиков"
        for uid in scheduled_ids:
            if uid not in active_ids and uid in users:
                user = users[uid]
                loc = user_locs.get(uid, "Yenibosna")
                if loc not in result: loc = "Unknown"
                
                result[loc].append({
                    "user_id": uid,
                    "name": user['name'],
                    "role": user['role'],
                    "status": "missing",
                    "shift": None
                })
        
        # Сортировка: Сначала работающие
        for k in result:
            result[k].sort(key=lambda x: (x['status'] == 'missing', x['name']))
            
        return result

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
    
@router.get("/settings/locations")
async def get_location_settings():
    """Получает настройки времени для всех локаций"""
    async with await get_db() as db:
        # Сначала убедимся, что все локации из Shifts есть в настройках
        locs_cursor = await db.execute("SELECT DISTINCT location FROM Shifts WHERE location IS NOT NULL")
        existing_locs = {row['location'] for row in await locs_cursor.fetchall()}
        
        for loc in existing_locs:
            await db.execute(
                "INSERT OR IGNORE INTO LocationSettings (location) VALUES (?)", 
                (loc,)
            )
        await db.commit()

        cursor = await db.execute("SELECT * FROM LocationSettings")
        return [dict(row) for row in await cursor.fetchall()]

@router.post("/settings/locations")
async def update_location_settings(settings: LocationSettingModel):
    """Обновляет время для конкретной локации"""
    async with await get_db() as db:
        await db.execute('''
            INSERT INTO LocationSettings (location, default_start_time, default_end_time)
            VALUES (?, ?, ?)
            ON CONFLICT(location) DO UPDATE SET
            default_start_time = excluded.default_start_time,
            default_end_time = excluded.default_end_time
        ''', (settings.location, settings.default_start_time, settings.default_end_time))
        await db.commit()
        return {"status": "success"}
    

# --- НОВЫЙ ЭНДПОИНТ: СОТРУДНИКИ ПО АКТИВНОСТИ ---
@router.get("/users/by-location-activity")
async def get_users_by_location_activity(location: str, days: int = 30):
    """
    Возвращает ID пользователей, которые работали в указанной локации 
    за последние N дней.
    """
    async with await get_db() as db:
        # Вычисляем дату отсечения
        cutoff_date = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        
        cursor = await db.execute('''
            SELECT DISTINCT user_id 
            FROM Shifts 
            WHERE location = ? 
              AND shift_date >= ?
        ''', (location, cutoff_date))
        
        user_ids = [row['user_id'] for row in await cursor.fetchall()]
        return user_ids

# --- НОВЫЕ ЭНДПОИНТЫ: НАСТРОЙКИ ВРЕМЕНИ ПО РОЛЯМ ---

@router.get("/settings/role-schedules")
async def get_role_schedules(location: str):
    """Получает настройки времени для ролей в конкретной локации"""
    async with await get_db() as db:
        cursor = await db.execute(
            "SELECT * FROM LocationRoleSettings WHERE location = ?", 
            (location,)
        )
        return [dict(row) for row in await cursor.fetchall()]

@router.post("/settings/role-schedules")
async def update_role_schedules(payload: RoleSettingsUpdate):
    """Обновляет настройки времени для ролей"""
    async with await get_db() as db:
        for item in payload.settings:
            await db.execute('''
                INSERT INTO LocationRoleSettings (location, role, default_start_time, default_end_time)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(location, role) DO UPDATE SET
                default_start_time = excluded.default_start_time,
                default_end_time = excluded.default_end_time
            ''', (item.location, item.role, item.default_start_time, item.default_end_time))
        await db.commit()
        return {"status": "success"}