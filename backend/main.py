import os
import re
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, HTTPException, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from jose import jwt
from pydantic import BaseModel
from dotenv import load_dotenv
import hashlib

# ИМПОРТЫ МОДУЛЕЙ
from .database import get_db, DB_NAME
from .payroll import router as payroll_router
from .reports import router as reports_router
from .schedules import router as schedules_router # Новый роутер

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "5Tg$8asD7v^9pQLz)3M2nX!0cB#jRh+V")
ALGORITHM = os.getenv("ALGORITHM", "HS256")

app = FastAPI(title="Shift Manager API v6.2 (Fully Modular)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ПОДКЛЮЧЕНИЕ РОУТЕРОВ
app.include_router(payroll_router)
app.include_router(reports_router)
app.include_router(schedules_router)

# --- МОДЕЛИ ДЛЯ ОСТАВШИХСЯ ЭНДПОИНТОВ ---
class TableUpdatePayload(BaseModel):
    updates: List[Dict[str, Any]]

class RateCreate(BaseModel):
    role: str
    amount: float
    period_type: str

class WorkPlanUpdate(BaseModel):
    role: str
    year: int
    month: int
    planned_hours: float

# --- AUTH & SYSTEM ---

@app.get("/health")
async def health_check():
    return {"status": "ok", "version": "v6.2"}

# Соль должна совпадать с миграцией
SALT = "super_secret_salt_shift_manager_2025"

def verify_password(plain_password, hashed_password):
    return hashlib.sha256((plain_password + SALT).encode()).hexdigest() == hashed_password

@app.post("/login")
async def login(username: str = Form(...), password: str = Form(...)): # Обратите внимание: username теперь принимаем
    async with await get_db() as db:
        cursor = await db.execute("SELECT * FROM web_users WHERE username = ?", (username,))
        user = await cursor.fetchone()
        
        if not user or not verify_password(password, user['password_hash']):
            raise HTTPException(status_code=401, detail="Неверный логин или пароль")
        
        # Генерируем токен (можно добавить роль в payload токена)
        access_token = jwt.encode(
            {
                "sub": user['username'], 
                "role": user['role'],
                "name": user['name'],
                "exp": datetime.utcnow() + timedelta(hours=12)
            }, 
            SECRET_KEY, algorithm=ALGORITHM
        )
        
        return {
            "access_token": access_token, 
            "token_type": "bearer",
            "role": user['role'],   # Отдаем роль фронтенду
            "name": user['name']    # Отдаем имя фронтенду
        }

# --- RATES (Тарифы) ---

@app.get("/rates")
async def get_rates():
    async with await get_db() as db:
        cursor = await db.execute("SELECT * FROM rates ORDER BY role")
        return [dict(row) for row in await cursor.fetchall()]

@app.post("/rates")
async def update_rate(rate: RateCreate):
    async with await get_db() as db:
        await db.execute('''
            INSERT INTO rates (role, amount, period_type) VALUES (?, ?, ?)
            ON CONFLICT(role, period_type) DO UPDATE SET amount = excluded.amount
        ''', (rate.role, rate.amount, rate.period_type))
        await db.commit()
        return {"status": "saved"}

@app.delete("/rates/{rate_id}")
async def delete_rate(rate_id: int):
    async with await get_db() as db:
        await db.execute("DELETE FROM rates WHERE id = ?", (rate_id,))
        await db.commit()
        return {"status": "deleted"}

# --- WORK PLANS (Планы по ролям) ---

@app.get("/work-plans/{year}/{month}")
async def get_work_plans(year: int, month: int):
    async with await get_db() as db:
        cursor = await db.execute("SELECT role, planned_hours FROM role_work_plans WHERE year = ? AND month = ?", (year, month))
        return {row['role']: row['planned_hours'] for row in await cursor.fetchall()}

@app.post("/work-plans")
async def save_work_plan(plan: WorkPlanUpdate):
    async with await get_db() as db:
        await db.execute('''
            INSERT INTO role_work_plans (role, year, month, planned_hours)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(role, year, month) DO UPDATE SET
            planned_hours = excluded.planned_hours, created_at = datetime('now')
        ''', (plan.role, plan.year, plan.month, plan.planned_hours))
        await db.commit()
        return {"status": "saved"}

# --- ADMIN TABLES CRUD ---

@app.get("/tables")
async def list_tables():
    async with await get_db() as db:
        cursor = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        return [row['name'] for row in await cursor.fetchall()]

@app.get("/tables/{table_name}")
async def get_table_data(table_name: str, page: int = 1, page_size: int = 25, search: Optional[str] = None):
    if not re.match(r'^[a-zA-Z0-9_]+$', table_name): raise HTTPException(status_code=400)
    offset = (page - 1) * page_size
    async with await get_db() as db:
        query = f"SELECT * FROM {table_name}"
        params = []
        if search:
            cols = [r['name'] for r in await (await db.execute(f"PRAGMA table_info({table_name})")).fetchall()]
            query += " WHERE " + " OR ".join([f"{c} LIKE ?" for c in cols])
            params = [f"%{search}%" for _ in cols]
        
        count_res = await (await db.execute(f"SELECT COUNT(*) as c FROM ({query})", params)).fetchone()
        total = count_res['c']
        
        query += " LIMIT ? OFFSET ?"
        params.extend([page_size, offset])
        data = [dict(r) for r in await (await db.execute(query, params)).fetchall()]
        
        return {"data": data, "total": total, "page": page, "pages": (total + page_size - 1) // page_size if page_size else 0}

@app.put("/tables/{table_name}")
async def update_table_row(table_name: str, payload: TableUpdatePayload):
    if not re.match(r'^[a-zA-Z0-9_]+$', table_name): raise HTTPException(status_code=400)
    async with await get_db() as db:
        try:
            for item in payload.updates:
                changes, original = item['changes'], item['original']
                if 'id' not in original: continue
                set_clauses = [f"{col} = ?" for col in changes.keys()]
                values = list(changes.values()) + [original['id']]
                await db.execute(f"UPDATE {table_name} SET {', '.join(set_clauses)} WHERE id = ?", values)
            await db.commit()
            return {"status": "success"}
        except Exception as e:
            await db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

@app.delete("/tables/{table_name}")
async def delete_table_row(table_name: str, request: Request):
    if not re.match(r'^[a-zA-Z0-9_]+$', table_name): raise HTTPException(status_code=400)
    row_data = await request.json()
    if 'id' not in row_data: raise HTTPException(status_code=400)
    async with await get_db() as db:
        try:
            await db.execute(f"DELETE FROM {table_name} WHERE id = ?", (row_data['id'],))
            await db.commit()
            return {"status": "deleted"}
        except Exception as e:
            await db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

# --- COMMON GETTERS ---

@app.get("/users")
async def get_users():
    async with await get_db() as db:
        c = await db.execute("SELECT * FROM Users")
        return [dict(r) for r in await c.fetchall()]

@app.get("/shifts")
async def get_shifts():
    async with await get_db() as db:
        cursor = await db.execute("SELECT s.*, u.name as user_name, u.role FROM Shifts s LEFT JOIN Users u ON s.user_id = u.id ORDER BY s.start_time DESC")
        return [dict(row) for row in await cursor.fetchall()]



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)