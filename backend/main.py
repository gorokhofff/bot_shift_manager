import os
import re
import asyncio
import aiosqlite
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from fastapi import FastAPI, Depends, HTTPException, Form, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from jose import JWTError, jwt
from pydantic import BaseModel
from dotenv import load_dotenv

# 1. ЗАГРУЗКА КОНФИГУРАЦИИ
load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "5Tg$8asD7v^9pQLz)3M2nX!0cB#jRh+V")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
# Используем абсолютный путь к БД, чтобы избежать проблем при запуске из разных папок
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_NAME = os.getenv("DATABASE_URL", os.path.join(BASE_DIR, "data", "shift_manager.db"))

app = FastAPI(title="Shift Manager API v3.1")

# 2. MIDDLEWARE (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# 3. МОДЕЛИ ДАННЫХ
class PayrollReportCreateV2(BaseModel):
    establishment_id: int
    year: int
    month: int
    revenue: Optional[float] = 0

class PayrollEntryUpdateV3(BaseModel):
    motivation_tl: Optional[float] = None
    advance_expenses: Optional[float] = None
    salary_expenses: Optional[float] = None

# 4. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ

async def get_db():
    # Создаем папку data, если её нет
    os.makedirs(os.path.dirname(DB_NAME), exist_ok=True)
    db = await aiosqlite.connect(DB_NAME, timeout=30.0)
    await db.execute("PRAGMA journal_mode=WAL")
    await db.execute("PRAGMA busy_timeout=10000")
    db.row_factory = aiosqlite.Row
    return db

async def parse_sales_from_reports(establishment_location: str, year: int, month: int) -> Tuple[int, int, int]:
    async with await get_db() as db:
        # Ищем отчеты за конкретный месяц и год
        cursor = await db.execute('''
            SELECT r.report_text, r.created_at
            FROM Reports r
            JOIN Shifts s ON r.shift_id = s.id
            WHERE s.location = ?
            AND strftime('%Y', r.created_at) = ? 
            AND strftime('%m', r.created_at) = ?
        ''', (establishment_location, str(year), f"{month:02d}"))
        reports = await cursor.fetchall()
        
        sales_1_15, sales_16_31 = 0, 0
        for row in reports:
            text = row['report_text']
            if not text: continue
            
            # Парсинг даты и продаж из текста отчета
            date_match = re.search(r'tarih\s*-\s*(\d{1,2})-(\d{1,2})-(\d{4})', text, re.IGNORECASE)
            sales_match = re.search(r'satış\s*-\s*(\d+)', text, re.IGNORECASE)
            
            if date_match and sales_match:
                day = int(date_match.group(1))
                count = int(sales_match.group(1))
                if 1 <= day <= 15: 
                    sales_1_15 += count
                else: 
                    sales_16_31 += count
                    
        return sales_1_15, sales_16_31, (sales_1_15 + sales_16_31)

def calculate_payroll_logic(role: str, s15: int, s31: int, motivation: float = 0) -> dict:
    """Логика расчета зарплаты (пример реализации)"""
    hookah_rate = 15.0  # Пример ставки за кальян
    
    if "кальянщик" in role.lower():
        adv_calc = s15 * hookah_rate
        sal_calc = (s31 * hookah_rate) + motivation
    else:
        # Для других ролей (фиксированные ставки - пример)
        adv_calc = 5000 
        sal_calc = 5000 + motivation
        
    return {
        "advance": round(adv_calc, 2),
        "salary": round(sal_calc, 2),
        "total": round(adv_calc + sal_calc, 2)
    }

# 5. ЭНДПОИНТЫ API

@app.get("/health")
async def health_check():
    return {"status": "ok", "db": DB_NAME, "time": datetime.now().isoformat()}

@app.post("/login")
async def login(password: str = Form(...)):
    if password == "admin1234":
        access_token = jwt.encode(
            {"sub": "admin", "exp": datetime.utcnow() + timedelta(hours=12)}, 
            SECRET_KEY, algorithm=ALGORITHM
        )
        return {"access_token": access_token, "token_type": "bearer"}
    raise HTTPException(status_code=401, detail="Invalid password")

@app.get("/users")
async def get_users():
    async with await get_db() as db:
        cursor = await db.execute("SELECT id, name, telegram_id, status, role FROM Users")
        return [dict(row) for row in await cursor.fetchall()]

@app.post("/payroll/generate-monthly")
async def generate_monthly_payroll_v3(draft_data: PayrollReportCreateV2):
    async with await get_db() as db:
        try:
            # 1. Создаем запись в payroll_reports
            cursor = await db.execute('''
                INSERT INTO payroll_reports (establishment_id, year, month, created_by, status, revenue)
                VALUES (?, ?, ?, ?, 'draft', ?)
            ''', (draft_data.establishment_id, draft_data.year, draft_data.month, 1, draft_data.revenue))
            report_id = cursor.lastrowid
            
            loc = "Yenibosna" if draft_data.establishment_id == 1 else "Göktürk"
            s15, s31, total_sales = await parse_sales_from_reports(loc, draft_data.year, draft_data.month)
            
            # Обновляем общие продажи в отчете
            await db.execute("UPDATE payroll_reports SET total_sales = ? WHERE id = ?", (total_sales, report_id))
            
            # 2. Получаем всех сотрудников, кто работал в этом месте в этом месяце
            cursor = await db.execute('''
                SELECT DISTINCT u.id, u.name, u.role 
                FROM Users u
                JOIN Shifts s ON u.id = s.user_id
                WHERE s.location = ? 
                AND strftime('%Y', s.shift_date) = ? 
                AND strftime('%m', s.shift_date) = ?
            ''', (loc, str(draft_data.year), f"{month:02d}" if (month := draft_data.month) else "01"))
            users = await cursor.fetchall()
            
            # 3. Генерируем детальные записи (entries) для каждого сотрудника
            for u in users:
                calc = calculate_payroll_logic(u['role'], s15, s31)
                
                await db.execute('''
                    INSERT INTO payroll_entries (
                        report_id, user_id, role, sales_1_15, sales_16_31,
                        advance_amount_calc, salary_amount_calc, monthly_total
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    report_id, u['id'], u['role'], s15, s31,
                    calc['advance'], calc['salary'], calc['total']
                ))
            
            await db.commit()
            return {"report_id": report_id, "status": "created", "total_sales": total_sales, "users_count": len(users)}
            
        except Exception as e:
            await db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)