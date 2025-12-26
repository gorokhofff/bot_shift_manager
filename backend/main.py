from fastapi import FastAPI, Depends, HTTPException, Form, Request, Query
from fastapi.middleware.cors import CORSMiddleware
import aiosqlite
from jose import JWTError, jwt
from datetime import datetime, timedelta
import math
import json
import asyncio
from pydantic import BaseModel
from typing import List, Dict, Any, Optional, Tuple
import calendar
import re

SECRET_KEY = "5Tg$8asD7v^9pQLz)3M2nX!0cB#jRh+V"
ALGORITHM = "HS256"
DB_NAME = "../shift_manager.db"

app = FastAPI()

# Добавьте это ПЕРЕД всеми роутами
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Разрешаем все домены
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Добавьте дополнительный middleware для обработки OPTIONS
@app.middleware("http")
async def add_cors_header(request: Request, call_next):
    if request.method == "OPTIONS":
        from fastapi.responses import Response
        return Response(
            status_code=200,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Max-Age": "3600",
            }
        )
    
    response = await call_next(request)
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response

# Тестовый эндпоинт
@app.get("/health")
async def health_check():
    return {"status": "ok", "message": "Server is running"}

# app = FastAPI()

# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],  # Разрешаем все домены
#     allow_credentials=True,
#     allow_methods=["*"],  # Разрешаем все методы
#     allow_headers=["*"],  # Разрешаем все заголовки
# )

# Модели данных
class ReportUpdate(BaseModel):
    report_text: str

class ReportUpdateRequest(BaseModel):
    report_text: str
    change_reason: Optional[str] = "Редактирование через парсер"
    changed_fields: Optional[Dict[str, Any]] = None

class RateCreate(BaseModel):
    role: str
    rate: float
    period_type: str  # '1-15', '16-end', 'per_hookah'
    effective_date: str

class RateUpdate(BaseModel):
    rate: float
    effective_date: str

class PayrollReportCreate(BaseModel):
    establishment_id: int
    period_start: str
    period_end: str
    revenue: Optional[float] = None

class PayrollReportUpdate(BaseModel):
    revenue: Optional[float] = None
    status: Optional[str] = None

class PayrollEntryUpdate(BaseModel):
    hours_worked: Optional[float] = None
    hookahs_sold: Optional[int] = None
    motivation_percent: Optional[float] = None
    prepaid_expense: Optional[float] = None
    card_payment: Optional[float] = None
    housing_deduction: Optional[float] = None

class PayrollGenerateDraft(BaseModel):
    establishment_id: int
    period_start: str
    period_end: str

class AddEmployeeRequest(BaseModel):
    user_id: int

# НОВЫЕ PYDANTIC МОДЕЛИ ДЛЯ v2/v3
class WorkPlanCreate(BaseModel):
    role: str
    year: int
    month: int
    planned_hours: float

class WorkPlanUpdate(BaseModel):
    planned_hours: float

class PayrollReportCreateV2(BaseModel):
    establishment_id: int
    year: int
    month: int
    revenue: Optional[float] = None

class PayrollEntryUpdateV2(BaseModel):
    # Общая часть
    monthly_tariff: Optional[float] = None
    motivation_percent: Optional[float] = None
    motivation_tl: Optional[float] = None
    hourly_rate_tl: Optional[float] = None
    
    # Аванс
    advance_expenses: Optional[float] = None
    advance_paid: Optional[bool] = None
    
    # Зарплата
    salary_expenses: Optional[float] = None
    salary_paid: Optional[bool] = None
    salary_comment: Optional[str] = None

# НОВЫЕ МОДЕЛИ ДЛЯ v3 (с продажами)
class PayrollEntryUpdateV3(BaseModel):
    # Общая часть
    monthly_tariff: Optional[float] = None
    motivation_percent: Optional[float] = None
    motivation_tl: Optional[float] = None
    hourly_rate_tl: Optional[float] = None
    actual_hours: Optional[float] = None  # Добавляем actual_hours
    
    # Продажи (для кальянщиков)
    sales_1_15: Optional[int] = None
    sales_16_31: Optional[int] = None
    
    # Аванс
    advance_expenses: Optional[float] = None
    advance_paid: Optional[bool] = None
    
    # Зарплата
    salary_expenses: Optional[float] = None
    salary_paid: Optional[bool] = None
    salary_comment: Optional[str] = None

class PayrollReportUpdateV3(BaseModel):
    revenue: Optional[float] = None
    total_sales: Optional[int] = None
    status: Optional[str] = None

# Кеш для тарифов (обновляется раз в час)
_rates_cache = {}
_rates_cache_timestamp = None
CACHE_DURATION = 3600  # 1 час

# Вспомогательные функции для расчета ФОТ
def get_last_day_of_month(year: int, month: int) -> int:
    """Получает последний день месяца"""
    return calendar.monthrange(year, month)[1]

def parse_period_dates(period_start: str, period_end: str):
    """Парсит даты периода"""
    try:
        start_date = datetime.fromisoformat(period_start.replace('Z', '+00:00'))
        end_date = datetime.fromisoformat(period_end.replace('Z', '+00:00'))
        return start_date, end_date
    except:
        # Fallback парсинг
        start_date = datetime.strptime(period_start[:10], '%Y-%m-%d')
        end_date = datetime.strptime(period_end[:10], '%Y-%m-%d')
        return start_date, end_date

async def get_current_rate(role: str, period_type: str, date_str: str) -> float:
    """Получает актуальный тариф для роли на дату"""
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute('''
            SELECT rate FROM rates 
            WHERE role = ? AND period_type = ? AND effective_date <= ?
            ORDER BY effective_date DESC
            LIMIT 1
        ''', (role, period_type, date_str))
        
        result = await cursor.fetchone()
        return result[0] if result else 0

async def get_hours_from_shifts(user_id: int, period_start: str, period_end: str) -> float:
    """Получает отработанные часы из таблицы Shifts"""
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute('''
            SELECT SUM(duration_hours) as total_hours
            FROM Shifts 
            WHERE user_id = ? 
            AND shift_date >= ? 
            AND shift_date <= ?
            AND duration_hours IS NOT NULL
        ''', (user_id, period_start, period_end))
        
        result = await cursor.fetchone()
        return result[0] if result and result[0] else 0

async def get_hookahs_from_reports(establishment_location: str, period_start: str, period_end: str) -> int:
    """Получает количество кальянов из отчетов по аналогии с reports-parse"""
    async with aiosqlite.connect(DB_NAME) as db:
        # Получаем отчеты через Shifts и фильтруем по локации
        cursor = await db.execute('''
            SELECT r.report_text
            FROM Reports r
            JOIN Shifts s ON r.shift_id = s.id
            WHERE s.location = ?
            AND DATE(r.created_at) >= ? 
            AND DATE(r.created_at) <= ?
        ''', (establishment_location, period_start, period_end))
        
        reports = await cursor.fetchall()
        total_hookahs = 0
        
        # Парсим отчеты для извлечения продаж кальянов
        import re
        for report in reports:
            if report[0]:
                # Ищем строку "satış - число"
                match = re.search(r'satış\s*-\s*(\d+)', report[0], re.IGNORECASE)
                if match:
                    total_hookahs += int(match.group(1))
        
        return total_hookahs


@app.put("/employee-schedules/{user_id}/{year}/{month}/{day}")
async def update_employee_schedule_day(user_id: int, year: int, month: int, day: int, request: dict):
    """Обновляет один день в расписании сотрудника"""
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute('''
            INSERT OR REPLACE INTO employee_schedules 
            (user_id, year, month, day, is_workday, notes)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (user_id, year, month, day, request.get('is_workday'), request.get('notes')))
        
        await db.commit()
        return {"status": "updated"}
    
# ============================================================================
# WORK SCHEDULES ENDPOINTS
# ============================================================================

@app.get("/work-schedules/{establishment_name}/{year}/{month}")
async def get_work_schedule(establishment_name: str, year: int, month: int):
    """Получает расписание работы для заведения на месяц"""
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute('''
            SELECT day, is_workday, work_hours_start, work_hours_end, notes
            FROM work_schedules 
            WHERE establishment_name = ? AND year = ? AND month = ?
            ORDER BY day
        ''', (establishment_name, year, month))
        
        rows = await cursor.fetchall()
        schedule = {}
        for row in rows:
            schedule[row[0]] = {
                'is_workday': bool(row[1]),
                'start_time': row[2],
                'end_time': row[3],
                'notes': row[4]
            }
        
        return schedule

@app.post("/work-schedules/generate")
async def generate_work_schedule(request: dict):
    """Генерирует расписание для заведения на месяц"""
    establishment_name = request.get('establishment_name')
    year = request.get('year')
    month = request.get('month')
    weekend_days = request.get('weekend_days', [0, 6])  # По умолчанию сб и вс
    
    import calendar
    days_in_month = calendar.monthrange(year, month)[1]
    
    async with aiosqlite.connect(DB_NAME) as db:
        for day in range(1, days_in_month + 1):
            date_obj = datetime(year, month, day)
            weekday = date_obj.weekday()
            is_workday = weekday not in weekend_days
            
            await db.execute('''
                INSERT OR REPLACE INTO work_schedules 
                (establishment_name, year, month, day, is_workday, work_hours_start, work_hours_end)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (establishment_name, year, month, day, is_workday, 
                  '15:00' if establishment_name == 'Yenibosna' else '16:00', 
                  '02:00'))
        
        await db.commit()
        return {"status": "generated", "days_created": days_in_month}

@app.put("/work-schedules/{establishment_name}/{year}/{month}/{day}")
async def update_work_schedule_day(establishment_name: str, year: int, month: int, day: int, request: dict):
    """Обновляет один день расписания"""
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute('''
            UPDATE work_schedules 
            SET is_workday = ?, work_hours_start = ?, work_hours_end = ?, notes = ?
            WHERE establishment_name = ? AND year = ? AND month = ? AND day = ?
        ''', (request.get('is_workday'), request.get('start_time'), 
              request.get('end_time'), request.get('notes'),
              establishment_name, year, month, day))
        
        await db.commit()
        return {"status": "updated"}

@app.get("/employee-schedules/{user_id}/{year}/{month}")
async def get_employee_schedule(user_id: int, year: int, month: int):
    """Получает индивидуальное расписание сотрудника на месяц"""
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute('''
            SELECT day, is_workday, notes
            FROM employee_schedules 
            WHERE user_id = ? AND year = ? AND month = ?
            ORDER BY day
        ''', (user_id, year, month))
        
        rows = await cursor.fetchall()
        schedule = {}
        for row in rows:
            schedule[row[0]] = {
                'is_workday': bool(row[1]),
                'notes': row[2]
            }
        
        return schedule

@app.post("/employee-schedules/generate")
async def generate_employee_schedule(request: dict):
    """Генерирует базовое расписание для сотрудника (по умолчанию все дни рабочие)"""
    user_id = request.get('user_id')
    year = request.get('year')
    month = request.get('month')
    
    import calendar
    days_in_month = calendar.monthrange(year, month)[1]
    
    async with aiosqlite.connect(DB_NAME) as db:
        for day in range(1, days_in_month + 1):
            await db.execute('''
                INSERT OR IGNORE INTO employee_schedules 
                (user_id, year, month, day, is_workday)
                VALUES (?, ?, ?, ?, ?)
            ''', (user_id, year, month, day, True))  # По умолчанию все дни рабочие
        
        await db.commit()
        return {"status": "generated", "days_created": days_in_month}


async def get_previous_motivation_percent(user_id: int) -> float:
    """Получает процент мотивации из предыдущего отчета"""
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute('''
            SELECT motivation_percent 
            FROM payroll_entries pe
            JOIN payroll_reports pr ON pe.payroll_report_id = pr.id
            WHERE pe.user_id = ?
            ORDER BY pr.created_at DESC
            LIMIT 1
        ''', (user_id,))
        
        result = await cursor.fetchone()
        return result[0] if result and result[0] else 0

async def get_previous_housing_deduction(user_id: int) -> float:
    """Получает квартирный вычет из предыдущего отчета"""
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute('''
            SELECT housing_deduction 
            FROM payroll_entries pe
            JOIN payroll_reports pr ON pe.payroll_report_id = pr.id
            WHERE pe.user_id = ?
            ORDER BY pr.created_at DESC
            LIMIT 1
        ''', (user_id,))
        
        result = await cursor.fetchone()
        return result[0] if result and result[0] else 0

async def parse_sales_from_reports(establishment_location: str, year: int, month: int) -> Tuple[int, int, int]:
    """Парсит продажи из отчетов по половинам месяца"""
    async with aiosqlite.connect(DB_NAME) as db:
        # Получаем все отчеты за месяц
        cursor = await db.execute('''
            SELECT r.report_text, r.created_at
            FROM Reports r
            JOIN Shifts s ON r.shift_id = s.id
            WHERE s.location = ?
            AND strftime('%Y', r.created_at) = ? 
            AND strftime('%m', r.created_at) = ?
        ''', (establishment_location, str(year), f"{month:02d}"))
        
        reports = await cursor.fetchall()
        
        sales_1_15 = 0
        sales_16_31 = 0
        
        for report_text, created_at in reports:
            if not report_text:
                continue
            
            # Ищем дату в отчете "tarih - DD-MM-YYYY"
            date_match = re.search(r'tarih\s*-\s*(\d{1,2})-(\d{1,2})-(\d{4})', report_text, re.IGNORECASE)
            
            # Ищем продажи "satış - число"
            sales_match = re.search(r'satış\s*-\s*(\d+)', report_text, re.IGNORECASE)
            
            if date_match and sales_match:
                day = int(date_match.group(1))
                sales_count = int(sales_match.group(1))
                
                # Распределяем по половинам месяца
                if 1 <= day <= 15:
                    sales_1_15 += sales_count
                elif 16 <= day <= 31:
                    sales_16_31 += sales_count
        
        total_sales = sales_1_15 + sales_16_31
        print(f"📊 Продажи {establishment_location} {month}/{year}: 1-15={sales_1_15}, 16-31={sales_16_31}, итого={total_sales}")
        
        return sales_1_15, sales_16_31, total_sales

async def get_monthly_tariff_for_role_updated(role: str, effective_date: str = None) -> Tuple[float, float, float]:
    """Получает тарифы для роли: аванс, зарплата, месячный итог"""
    async with aiosqlite.connect(DB_NAME) as db:
        if not effective_date:
            effective_date = datetime.now().isoformat()
        
        # Для кальянщиков возвращаем нули (рассчитывается от продаж)
        if role in ['кальянщик', 'старший кальянщик']:
            return 0, 0, 0
        
        # Получаем тарифы 1-15 и 16-end
        cursor = await db.execute('''
            SELECT period_type, rate FROM rates 
            WHERE role = ? AND period_type IN ('1-15', '16-end')
            AND effective_date <= ?
            ORDER BY effective_date DESC
            LIMIT 2
        ''', (role, effective_date))
        
        rate_data = await cursor.fetchall()
        
        advance_rate = 0
        salary_rate = 0
        
        for period_type, rate in rate_data:
            if period_type == '1-15':
                advance_rate = rate
            elif period_type == '16-end':
                salary_rate = rate
        
        monthly_total = advance_rate + salary_rate
        
        return advance_rate, salary_rate, monthly_total

async def get_hookah_rate_for_role(role: str, effective_date: str = None) -> float:
    """Получает ставку за кальян для кальянщиков"""
    async with aiosqlite.connect(DB_NAME) as db:
        if not effective_date:
            effective_date = datetime.now().isoformat()
        
        cursor = await db.execute('''
            SELECT rate FROM rates 
            WHERE role = ? AND period_type = 'per_hookah'
            AND effective_date <= ?
            ORDER BY effective_date DESC
            LIMIT 1
        ''', (role, effective_date))
        
        result = await cursor.fetchone()
        return result[0] if result else 10  # По умолчанию 10 TL за кальян

async def calculate_motivation_amount(motivation_percent: float, monthly_revenue: float) -> float:
    """Рассчитывает сумму мотивации"""
    if not motivation_percent or not monthly_revenue:
        return 0
    
    revenue_without_service = monthly_revenue / 1.1  # Убираем сервис
    motivation_amount = (motivation_percent / 100) * revenue_without_service
    
    return round(motivation_amount, 2)

def calculate_payroll_entry(entry_data: dict, revenue: float, total_hookahs: int, period_type: str) -> dict:
    """Рассчитывает все поля для записи ФОТ"""
    role = entry_data.get('role', '')
    hours_worked = entry_data.get('hours_worked', 0)
    hookahs_sold = entry_data.get('hookahs_sold', 0)
    motivation_percent = entry_data.get('motivation_percent', 0)
    prepaid_expense = entry_data.get('prepaid_expense', 0)
    card_payment = entry_data.get('card_payment', 0)
    housing_deduction = entry_data.get('housing_deduction', 0)
    
    # Базовая зарплата
    if role in ['кальянщик', 'старший кальянщик']:
        # Для кальянщиков - фиксированная ставка за кальян
        base_rate = entry_data.get('rate_per_hookah', 10)
        base_salary = hookahs_sold * base_rate
    else:
        # Для остальных - фиксированная ставка за период
        base_salary = entry_data.get('rate_for_period', 0)
    
    # Мотивация
    revenue_without_service = revenue / 1.1 if revenue else 0
    motivation_amount = (motivation_percent / 100) * revenue_without_service if motivation_percent else 0
    
    # Итоговая выплата
    final_payment = base_salary + motivation_amount - prepaid_expense - card_payment - housing_deduction
    final_payment = max(0, final_payment)  # Не может быть отрицательной
    
    return {
        'base_salary': round(base_salary, 2),
        'motivation_amount': round(motivation_amount, 2),
        'final_payment': round(final_payment, 2)
    }

# НОВАЯ ФУНКЦИЯ ДЛЯ v3
def calculate_payroll_entry_v3(entry_data: dict) -> dict:
    """Рассчитывает все поля для записи ФОТ v3 с продажами"""
    
    role = entry_data.get('role', '')
    sales_1_15 = entry_data.get('sales_1_15', 0)
    sales_16_31 = entry_data.get('sales_16_31', 0)
    hookah_rate = entry_data.get('hookah_rate', 10)
    advance_rate = entry_data.get('advance_rate', 0)
    salary_rate = entry_data.get('salary_rate', 0)
    motivation_amount = entry_data.get('motivation_amount', 0)
    advance_expenses = entry_data.get('advance_expenses', 0)
    salary_expenses = entry_data.get('salary_expenses', 0)
    
    # Рассчитываем по ролям
    if role in ['кальянщик', 'старший кальянщик']:
        # Для кальянщиков - от продаж
        advance_amount_calc = sales_1_15 * hookah_rate
        salary_amount_calc = sales_16_31 * hookah_rate + motivation_amount
        total_sales = sales_1_15 + sales_16_31
        monthly_total = advance_amount_calc + salary_amount_calc
    else:
        # Для остальных ролей - от тарифов
        advance_amount_calc = advance_rate
        salary_amount_calc = salary_rate + motivation_amount
        total_sales = 0
        monthly_total = advance_amount_calc + salary_amount_calc
    
    # К выплате
    advance_total = max(0, advance_amount_calc - advance_expenses)
    salary_total = max(0, salary_amount_calc - salary_expenses)
    
    return {
        'advance_amount_calc': round(advance_amount_calc, 2),
        'salary_amount_calc': round(salary_amount_calc, 2),
        'advance_total': round(advance_total, 2),
        'salary_total': round(salary_total, 2),
        'monthly_total': round(monthly_total, 2),
        'total_sales': total_sales
    }

# ============================================================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ v2
# ============================================================================

async def get_work_plan(role: str, year: int, month: int) -> float:
    """Получает план часов для роли на месяц"""
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute('''
            SELECT planned_hours FROM work_plans 
            WHERE role = ? AND year = ? AND month = ?
        ''', (role, year, month))
        
        result = await cursor.fetchone()
        return result[0] if result else 160  # По умолчанию 160 часов

async def get_hourly_rate_for_user(user_id: int, role: str) -> float:
    """Получает часовую ставку для пользователя (из предыдущего ФОТ или из тарифов)"""
    async with aiosqlite.connect(DB_NAME) as db:
        # Сначала ищем в предыдущих ФОТ этого пользователя
        cursor = await db.execute('''
            SELECT pe.hourly_rate_tl 
            FROM payroll_entries pe
            JOIN payroll_reports pr ON pe.payroll_report_id = pr.id
            WHERE pe.user_id = ? AND pe.hourly_rate_tl > 0
            ORDER BY pr.year DESC, pr.month DESC
            LIMIT 1
        ''', (user_id,))
        
        result = await cursor.fetchone()
        if result and result[0]:
            return result[0]
        
        # Если не найдено, берем из тарифов по роли
        cursor = await db.execute('''
            SELECT hourly_rate_tl FROM rates 
            WHERE role = ? AND hourly_rate_tl > 0
            ORDER BY effective_date DESC
            LIMIT 1
        ''', (role,))
        
        result = await cursor.fetchone()
        return result[0] if result and result[0] else 75  # По умолчанию 75 TL/час

async def get_previous_motivation_percent_v2(user_id: int) -> float:
    """Получает процент мотивации из предыдущего ФОТ v2"""
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute('''
            SELECT motivation_percent 
            FROM payroll_entries pe
            JOIN payroll_reports pr ON pe.payroll_report_id = pr.id
            WHERE pe.user_id = ? AND pe.motivation_percent > 0
            ORDER BY pr.year DESC, pr.month DESC
            LIMIT 1
        ''', (user_id,))
        
        result = await cursor.fetchone()
        return result[0] if result and result[0] else 0

async def get_monthly_tariff_for_role(role: str) -> float:
    """Получает месячный тариф для роли"""
    async with aiosqlite.connect(DB_NAME) as db:
        # Для кальянщиков тариф = 0 (рассчитывается по часам)
        if role in ['кальянщик', 'старший кальянщик']:
            return 0
        
        # Для остальных ролей - сумма тарифов 1-15 и 16-end
        cursor = await db.execute('''
            SELECT SUM(rate) as monthly_rate
            FROM rates 
            WHERE role = ? AND period_type IN ('1-15', '16-end')
            AND effective_date <= date('now')
            ORDER BY effective_date DESC
            LIMIT 2
        ''', (role,))
        
        result = await cursor.fetchone()
        return result[0] if result and result[0] else 25000  # По умолчанию

async def get_actual_hours_for_month(user_id: int, year: int, month: int) -> float:
    """Получает фактически отработанные часы за месяц"""
    async with aiosqlite.connect(DB_NAME) as db:
        # Получаем все смены пользователя за месяц
        cursor = await db.execute('''
            SELECT SUM(duration_hours) as total_hours
            FROM Shifts 
            WHERE user_id = ? 
            AND strftime('%Y', shift_date) = ? 
            AND strftime('%m', shift_date) = ?
            AND duration_hours IS NOT NULL
        ''', (user_id, str(year), f"{month:02d}"))
        
        result = await cursor.fetchone()
        return result[0] if result and result[0] else 0

def calculate_advance_amount(monthly_tariff: float) -> float:
    """Рассчитывает сумму аванса (обычно 50% от месячного тарифа)"""
    return round(monthly_tariff * 0.5, 2)

def calculate_payroll_entry_v2(entry_data: dict) -> dict:
    """Рассчитывает все поля для записи ФОТ v2"""
    
    # Исходные данные
    monthly_tariff = entry_data.get('monthly_tariff', 0)
    motivation_percent = entry_data.get('motivation_percent', 0)
    motivation_tl = entry_data.get('motivation_tl', 0)
    planned_hours = entry_data.get('planned_hours', 0)
    hourly_rate_tl = entry_data.get('hourly_rate_tl', 0)
    actual_hours = entry_data.get('actual_hours', 0)
    
    # Расходы
    advance_expenses = entry_data.get('advance_expenses', 0)
    salary_expenses = entry_data.get('salary_expenses', 0)
    
    # Расчеты
    monthly_income = monthly_tariff + motivation_tl
    monthly_total = actual_hours * hourly_rate_tl
    
    # Аванс
    advance_amount = calculate_advance_amount(monthly_tariff)
    advance_total = advance_amount - advance_expenses
    
    # Зарплата  
    salary_remainder = monthly_total - advance_total
    salary_total = salary_remainder - salary_expenses
    
    return {
        'monthly_income': round(monthly_income, 2),
        'monthly_total': round(monthly_total, 2),
        'advance_amount': round(advance_amount, 2),
        'advance_total': round(max(0, advance_total), 2),
        'salary_remainder': round(salary_remainder, 2),
        'salary_total': round(max(0, salary_total), 2)
    }

# Функции для работы с аудитом
def generate_changes_summary(old_text: Optional[str], new_text: str, changed_fields: Optional[Dict] = None) -> str:
    """Генерирует краткое описание изменений"""
    if not old_text:
        return "Создание отчета"
    
    if changed_fields:
        field_names = list(changed_fields.keys())
        if len(field_names) == 1:
            return f"Изменено поле: {field_names[0]}"
        elif len(field_names) <= 3:
            return f"Изменены поля: {', '.join(field_names)}"
        else:
            return f"Изменено {len(field_names)} полей"
    
    # Простое сравнение длины текста
    old_len = len(old_text) if old_text else 0
    new_len = len(new_text)
    
    if abs(new_len - old_len) > 50:
        return f"Значительные изменения текста ({old_len} → {new_len} символов)"
    else:
        return "Небольшие изменения текста"

def get_client_info(request: Request) -> tuple:
    """Извлекает информацию о клиенте из запроса"""
    ip_address = request.client.host
    user_agent = request.headers.get('user-agent', 'Unknown')
    return ip_address, user_agent

async def create_audit_log_entry(
    report_id: int,
    action_type: str,
    old_text: Optional[str],
    new_text: str,
    changed_fields: Optional[Dict] = None,
    change_reason: Optional[str] = None,
    created_by: int = 1,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
):
    """Создает запись в логе аудита с повторными попытками при блокировке"""
    for attempt in range(5):  # 5 попыток
        try:
            async with aiosqlite.connect(DB_NAME, timeout=30.0) as db:
                # Настройки для одновременной работы с телеграм ботом
                await db.execute("PRAGMA journal_mode=WAL")
                await db.execute("PRAGMA synchronous=NORMAL")
                await db.execute("PRAGMA busy_timeout=10000")  # 10 секунд ожидания
                await db.execute("PRAGMA wal_autocheckpoint=1000")
                
                # Получаем текущую версию отчета
                cursor = await db.execute("SELECT version FROM Reports WHERE id = ?", (report_id,))
                result = await cursor.fetchone()
                current_version = result[0] if result else 1
                
                # Создаем краткое описание изменений
                changes_summary = generate_changes_summary(old_text, new_text, changed_fields)
                
                # Увеличиваем версию отчета
                new_version = current_version + 1
                await db.execute(
                    "UPDATE Reports SET version = ?, updated_by = ? WHERE id = ?",
                    (new_version, created_by, report_id)
                )
                
                # Создаем запись в аудит-логе
                await db.execute('''
                    INSERT INTO ReportsAuditLog 
                    (report_id, version, action_type, old_text, new_text, changes_summary,
                     changed_fields, change_reason, created_at, created_by, ip_address, user_agent)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    report_id, new_version, action_type, old_text, new_text, changes_summary,
                    json.dumps(changed_fields) if changed_fields else None,
                    change_reason, datetime.now().isoformat(), created_by, ip_address, user_agent
                ))
                
                await db.commit()
                print(f"✅ Аудит запись создана для отчета {report_id}, версия {new_version}")
                return new_version
                
        except Exception as e:
            error_msg = str(e).lower()
            if ("database is locked" in error_msg or "busy" in error_msg) and attempt < 4:
                wait_time = 0.5 * (2 ** attempt)  # Экспоненциальная задержка
                print(f"⏳ База заблокирована, попытка {attempt + 1}/5, ждем {wait_time}с...")
                await asyncio.sleep(wait_time)
                continue
            else:
                print(f"❌ Ошибка создания аудит записи: {e}")
                raise e
    
    raise Exception("Не удалось создать запись аудита после 5 попыток")

# Эндпоинты
@app.post("/login")
async def login(password: str = Form(...)):
    if password == "admin1234":
        access_token = jwt.encode({"sub": "admin", "exp": datetime.utcnow() + timedelta(hours=12)}, SECRET_KEY, algorithm=ALGORITHM)
        return {"access_token": access_token}
    raise HTTPException(status_code=401, detail="Неверный пароль")

@app.get("/users")
async def get_users():
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute("SELECT id, name, telegram_id, status, role FROM Users")
        rows = await cursor.fetchall()
        users = [{"id": row[0], "name": row[1], "telegram_id": row[2], "status": row[3], "role": row[4]} for row in rows]
        return users

@app.get("/shifts")
async def get_shifts():
    async with aiosqlite.connect(DB_NAME) as db:
        # ИСПРАВЛЕННЫЙ запрос с правильным JOIN
        cursor = await db.execute('''
            SELECT 
                s.id, 
                s.user_id, 
                u.name as user_name, 
                s.shift_date, 
                s.start_time, 
                s.end_time, 
                s.duration_hours, 
                s.location 
            FROM Shifts s
            LEFT JOIN Users u ON s.user_id = u.id
            ORDER BY s.start_time DESC
        ''')
        
        rows = await cursor.fetchall()
        shifts = []
        
        for row in rows:
            shifts.append({
                "id": row[0], 
                "user_id": row[1], 
                "user_name": row[2] if row[2] else f"ID: {row[1]}", 
                "shift_date": row[3], 
                "start_time": row[4], 
                "end_time": row[5], 
                "duration_hours": row[6], 
                "location": row[7]
            })
        
        return shifts

# @app.get("/reports")
# async def get_reports():
#     async with aiosqlite.connect(DB_NAME) as db:
#         cursor = await db.execute("SELECT id, shift_id, report_text, created_at FROM Reports")
#         rows = await cursor.fetchall()
#         reports = [{"id": row[0], "shift_id": row[1], "report_text": row[2], "created_at": row[3]} for row in rows]
#         return reports

# Обновить в main.py endpoint /reports

@app.get("/reports")
async def get_reports():
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute('''
            SELECT 
                r.id, 
                r.shift_id, 
                r.report_text, 
                r.created_at,
                r.updated_at,
                r.updated_by,
                r.version,
                s.user_id,
                u.name as user_name
            FROM Reports r
            LEFT JOIN Shifts s ON r.shift_id = s.id
            LEFT JOIN Users u ON s.user_id = u.id
            ORDER BY r.created_at DESC
        ''')
        rows = await cursor.fetchall()
        
        reports = []
        for row in rows:
            reports.append({
                "id": row[0], 
                "shift_id": row[1], 
                "report_text": row[2], 
                "created_at": row[3],
                "updated_at": row[4],
                "updated_by": row[5], 
                "version": row[6],
                "user_id": row[7],  # Это user_id из таблицы Shifts
                "user_name": row[8]  # Это name из таблицы Users
            })
        
        return reports

# Обновленный эндпоинт для обновления отчетов с аудитом
@app.put("/reports/{report_id}")
async def update_report_with_audit(
    report_id: int, 
    payload: ReportUpdateRequest,
    request: Request
):
    """Обновляет отчет с записью в аудит-лог"""
    for attempt in range(3):  # 3 попытки для основной операции
        try:
            async with aiosqlite.connect(DB_NAME, timeout=30.0) as db:
                # Настройки для работы с телеграм ботом
                await db.execute("PRAGMA journal_mode=WAL")
                await db.execute("PRAGMA synchronous=NORMAL")
                await db.execute("PRAGMA busy_timeout=10000")
                
                # Получаем текущий отчет
                cursor = await db.execute("SELECT report_text FROM Reports WHERE id = ?", (report_id,))
                result = await cursor.fetchone()
                
                if not result:
                    raise HTTPException(status_code=404, detail="Report not found")
                
                old_text = result[0]
                new_text = payload.report_text
                
                # Проверяем, есть ли изменения
                if old_text == new_text:
                    return {"status": "no_changes", "message": "No changes detected"}
                
                # Обновляем отчет
                await db.execute(
                    "UPDATE Reports SET report_text = ? WHERE id = ?",
                    (new_text, report_id)
                )
                await db.commit()
                
                print(f"✅ Отчет {report_id} обновлен в основной таблице")
                
                # Получаем информацию о клиенте
                ip_address, user_agent = get_client_info(request)
                
                # Создаем запись в аудит-логе (отдельно, чтобы избежать длинных транзакций)
                try:
                    new_version = await create_audit_log_entry(
                        report_id=report_id,
                        action_type="parsed_edit",
                        old_text=old_text,
                        new_text=new_text,
                        changed_fields=payload.changed_fields,
                        change_reason=payload.change_reason,
                        created_by=1,  # TODO: получать из JWT токена
                        ip_address=ip_address,
                        user_agent=user_agent
                    )
                except Exception as audit_error:
                    print(f"⚠️ Не удалось создать запись аудита: {audit_error}")
                    # Отчет уже обновлен, аудит не критичен
                    new_version = 1
                
                return {
                    "status": "updated",
                    "version": new_version,
                    "changes_summary": generate_changes_summary(old_text, new_text, payload.changed_fields)
                }
                
        except Exception as e:
            error_msg = str(e).lower()
            if ("database is locked" in error_msg or "busy" in error_msg) and attempt < 2:
                wait_time = 0.5 * (attempt + 1)
                print(f"⏳ База заблокирована, попытка {attempt + 1}/3, ждем {wait_time}с...")
                await asyncio.sleep(wait_time)
                continue
            else:
                print(f"❌ Ошибка обновления отчета {report_id}: {e}")
                if "not found" in error_msg:
                    raise HTTPException(status_code=404, detail="Report not found")
                else:
                    raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    
    raise HTTPException(status_code=500, detail="Database is busy, please try again later")

# Получение истории изменений отчета
@app.get("/reports/{report_id}/audit")
async def get_report_audit_history(report_id: int):
    """Получает историю изменений отчета"""
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute('''
            SELECT ral.*, u.name as user_name
            FROM ReportsAuditLog ral
            LEFT JOIN Users u ON ral.created_by = u.id
            WHERE ral.report_id = ?
            ORDER BY ral.created_at DESC
        ''', (report_id,))
        
        audit_entries = await cursor.fetchall()
        
        return [
            {
                "id": entry[0],
                "report_id": entry[1],
                "version": entry[2],
                "action_type": entry[3],
                "old_text": entry[4],
                "new_text": entry[5],
                "changes_summary": entry[6],
                "changed_fields": json.loads(entry[7]) if entry[7] else None,
                "change_reason": entry[8],
                "created_at": entry[9],
                "created_by": entry[10],
                "ip_address": entry[11],
                "user_agent": entry[12],
                "user_name": entry[13] if len(entry) > 13 else None
            }
            for entry in audit_entries
        ]

# Получение статистики по изменениям
@app.get("/reports/audit/stats")
async def get_audit_statistics():
    """Получает статистику по изменениям отчетов"""
    async with aiosqlite.connect(DB_NAME) as db:
        # Общая статистика
        cursor = await db.execute('''
            SELECT 
                COUNT(*) as total_changes,
                COUNT(DISTINCT report_id) as reports_changed,
                COUNT(DISTINCT created_by) as users_involved,
                MIN(created_at) as first_change,
                MAX(created_at) as last_change
            FROM ReportsAuditLog
        ''')
        general_stats = await cursor.fetchone()
        
        return {
            "general": {
                "total_changes": general_stats[0] if general_stats[0] else 0,
                "reports_changed": general_stats[1] if general_stats[1] else 0,
                "users_involved": general_stats[2] if general_stats[2] else 0,
                "first_change": general_stats[3],
                "last_change": general_stats[4]
            }
        }

# ТАРИФЫ 
@app.get("/rates")
async def get_rates():
    """Получает все тарифы"""
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute('''
            SELECT id, role, rate, period_type, effective_date, created_at, updated_at
            FROM rates 
            ORDER BY role, effective_date DESC
        ''')
        rates = await cursor.fetchall()
        
        return [
            {
                "id": rate[0],
                "role": rate[1],
                "rate": rate[2],
                "period_type": rate[3],
                "effective_date": rate[4],
                "created_at": rate[5],
                "updated_at": rate[6]
            }
            for rate in rates
        ]

@app.post("/rates")
async def create_rate(rate_data: RateCreate):
    """Создает новый тариф"""
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute('''
            INSERT INTO rates (role, rate, period_type, effective_date)
            VALUES (?, ?, ?, ?)
        ''', (rate_data.role, rate_data.rate, rate_data.period_type, rate_data.effective_date))
        
        rate_id = cursor.lastrowid
        await db.commit()
        
        return {"id": rate_id, "status": "created"}

@app.put("/rates/{rate_id}")
async def update_rate(rate_id: int, rate_data: RateUpdate):
    """Обновляет тариф"""
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute('''
            UPDATE rates 
            SET rate = ?, effective_date = ?
            WHERE id = ?
        ''', (rate_data.rate, rate_data.effective_date, rate_id))
        
        await db.commit()
        return {"status": "updated"}

# ============================================================================
# PAYROLL v3 - Основные endpoints для новой системы ФОТ с продажами
# ============================================================================

@app.post("/payroll/generate-monthly")
async def generate_monthly_payroll_v3(draft_data: PayrollReportCreateV2):
    """Генерирует месячный отчет ФОТ v3 с продажами"""
    try:
        async with aiosqlite.connect(DB_NAME) as db:
            # Создаем основной отчет
            cursor = await db.execute('''
                INSERT INTO payroll_reports (establishment_id, year, month, created_by)
                VALUES (?, ?, ?, ?)
            ''', (draft_data.establishment_id, draft_data.year, draft_data.month, 1))
            
            report_id = cursor.lastrowid
            
            # Получаем локацию заведения
            establishment_locations = {1: "Yenibosna", 2: "Göktürk"}
            establishment_location = establishment_locations.get(draft_data.establishment_id, "Yenibosna")
            
            # Парсим продажи из отчетов
            sales_1_15, sales_16_31, total_sales = await parse_sales_from_reports(
                establishment_location, draft_data.year, draft_data.month
            )
            
            # Обновляем отчет с общими продажами
            await db.execute('''
                UPDATE payroll_reports 
                SET total_sales = ?
                WHERE id = ?
            ''', (total_sales, report_id))
            
            # Получаем всех пользователей, которые работали в заведении в этом месяце
            cursor = await db.execute('''
                SELECT DISTINCT u.id, u.name, u.role
                FROM Users u
                JOIN Shifts s ON u.id = s.user_id
                WHERE s.location = ?
                AND strftime('%Y', s.shift_date) = ? 
                AND strftime('%m', s.shift_date) = ?
                AND u.role IS NOT NULL
            ''', (establishment_location, str(draft_data.year), f"{draft_data.month:02d}"))
            
            users = await cursor.fetchall()
            
            # Создаем записи для каждого сотрудника
            for user in users:
                user_id, user_name, user_role = user
                
                # Получаем данные для расчета
                planned_hours = await get_work_plan(user_role, draft_data.year, draft_data.month)
                actual_hours = await get_actual_hours_for_month(user_id, draft_data.year, draft_data.month)
                hourly_rate_tl = await get_hourly_rate_for_user(user_id, user_role)
                motivation_percent = await get_previous_motivation_percent_v2(user_id)
                
                # Получаем тарифы
                if user_role in ['кальянщик', 'старший кальянщик']:
                    # Для кальянщиков
                    hookah_rate = await get_hookah_rate_for_role(user_role)
                    advance_rate = 0
                    salary_rate = 0
                    monthly_tariff = 0
                    
                    # Продажи для кальянщиков
                    user_sales_1_15 = sales_1_15
                    user_sales_16_31 = sales_16_31
                    user_total_sales = total_sales
                else:
                    # Для остальных ролей
                    advance_rate, salary_rate, monthly_tariff = await get_monthly_tariff_for_role_updated(user_role)
                    hookah_rate = 0
                    
                    # Продажи не учитываются
                    user_sales_1_15 = 0
                    user_sales_16_31 = 0
                    user_total_sales = 0
                
                # Рассчитываем поля
                entry_data = {
                    'role': user_role,
                    'sales_1_15': user_sales_1_15,
                    'sales_16_31': user_sales_16_31,
                    'hookah_rate': hookah_rate,
                    'advance_rate': advance_rate,
                    'salary_rate': salary_rate,
                    'motivation_amount': 0,  # Пока 0, пользователь заполнит
                    'advance_expenses': 0,
                    'salary_expenses': 0
                }
                
                calculated = calculate_payroll_entry_v3(entry_data)
                
                # Создаем запись
                await db.execute('''
                    INSERT INTO payroll_entries 
                    (payroll_report_id, user_id, monthly_tariff, motivation_percent, motivation_tl,
                     monthly_income, planned_hours, hourly_rate_tl, actual_hours, monthly_total,
                     advance_amount, advance_expenses, advance_total, advance_paid,
                     salary_remainder, salary_expenses, salary_total, salary_paid, salary_comment,
                     created_at, updated_at, sales_1_15, sales_16_31, total_sales, 
                     advance_amount_calc, salary_amount_calc)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    report_id, user_id, monthly_tariff, motivation_percent, 0,
                    calculated['monthly_total'], planned_hours, hourly_rate_tl, actual_hours, calculated['monthly_total'],
                    calculated['advance_amount_calc'], 0, calculated['advance_total'], False,
                    calculated['salary_amount_calc'], 0, calculated['salary_total'], False, '',
                    datetime.now().isoformat(), datetime.now().isoformat(),
                    user_sales_1_15, user_sales_16_31, user_total_sales, 
                    calculated['advance_amount_calc'], calculated['salary_amount_calc']
                ))
            
            await db.commit()
            
            return {
                "report_id": report_id,
                "status": "draft_created",
                "employees_count": len(users),
                "total_sales": total_sales,
                "sales_breakdown": {
                    "sales_1_15": sales_1_15,
                    "sales_16_31": sales_16_31
                }
            }
            
    except Exception as e:
        print(f"❌ Ошибка создания отчета ФОТ v3: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка создания отчета: {str(e)}")

@app.get("/payroll/reports-v2")
async def get_payroll_reports_v2():
    """Получает все отчеты ФОТ v2"""
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute('''
            SELECT pr.*, u.name as created_by_name
            FROM payroll_reports pr
            LEFT JOIN Users u ON pr.created_by = u.id
            ORDER BY pr.year DESC, pr.month DESC, pr.created_at DESC
        ''')
        reports = await cursor.fetchall()
        
        return [
            {
                "id": report[0],
                "establishment_id": report[1],
                "year": report[2],
                "month": report[3],
                "revenue": report[4],
                "total_hookahs": report[5],
                "status": report[6],
                "created_by": report[7],
                "created_at": report[8],
                "updated_at": report[9],
                "total_sales": report[10] if len(report) > 10 else 0,
                "created_by_name": report[11] if len(report) > 11 else None
            }
            for report in reports
        ]

@app.get("/payroll/reports-v2/{report_id}")
async def get_payroll_report_v3(report_id: int):
    """Получает отчет ФОТ v3 с продажами"""
    async with aiosqlite.connect(DB_NAME) as db:
        # Получаем основной отчет
        cursor = await db.execute('''
            SELECT pr.*, u.name as created_by_name
            FROM payroll_reports pr
            LEFT JOIN Users u ON pr.created_by = u.id
            WHERE pr.id = ?
        ''', (report_id,))
        
        report = await cursor.fetchone()
        if not report:
            raise HTTPException(status_code=404, detail="Отчет не найден")
        
        # Получаем записи по сотрудникам
        cursor = await db.execute('''
            SELECT pe.*, u.name as user_name, u.role as user_role
            FROM payroll_entries pe
            LEFT JOIN Users u ON pe.user_id = u.id
            WHERE pe.payroll_report_id = ?
            ORDER BY 
                CASE 
                    WHEN u.role IN ('кальянщик', 'старший кальянщик') THEN 1 
                    ELSE 2 
                END,
                u.role, u.name
        ''', (report_id,))
        
        entries = await cursor.fetchall()
        
        return {
            "report": {
                "id": report[0],
                "establishment_id": report[1],
                "year": report[2],
                "month": report[3],
                "revenue": report[4],
                "total_hookahs": report[5],  # Deprecated, используем total_sales
                "total_sales": report[10] if len(report) > 10 else 0,  # Новое поле
                "status": report[6],
                "created_by": report[7],
                "created_at": report[8],
                "updated_at": report[9],
                "created_by_name": report[11] if len(report) > 11 else None
            },
            "entries": [
                {
                    "id": entry[0],
                    "user_id": entry[2],
                    "user_name": entry[-2] if len(entry) > 2 else "Неизвестен",
                    "user_role": entry[-1] if len(entry) > 1 else None,
                    
                    # Общая часть
                    "monthly_tariff": entry[3] if len(entry) > 3 else 0,
                    "motivation_percent": entry[4] if len(entry) > 4 else 0,
                    "motivation_tl": entry[5] if len(entry) > 5 else 0,
                    "monthly_income": entry[6] if len(entry) > 6 else 0,
                    "planned_hours": entry[7] if len(entry) > 7 else 0,
                    "hourly_rate_tl": entry[8] if len(entry) > 8 else 0,
                    "actual_hours": entry[9] if len(entry) > 9 else 0,
                    "monthly_total": entry[10] if len(entry) > 10 else 0,
                    
                    # Аванс
                    "advance_amount": entry[11] if len(entry) > 11 else 0,
                    "advance_expenses": entry[12] if len(entry) > 12 else 0,
                    "advance_total": entry[13] if len(entry) > 13 else 0,
                    "advance_paid": entry[14] if len(entry) > 14 else False,
                    
                    # Зарплата
                    "salary_remainder": entry[15] if len(entry) > 15 else 0,
                    "salary_expenses": entry[16] if len(entry) > 16 else 0,
                    "salary_total": entry[17] if len(entry) > 17 else 0,
                    "salary_paid": entry[18] if len(entry) > 18 else False,
                    "salary_comment": entry[19] if len(entry) > 19 else "",
                    
                    # Продажи (новые поля)
                    "sales_1_15": entry[22] if len(entry) > 22 else 0,
                    "sales_16_31": entry[23] if len(entry) > 23 else 0,
                    "total_sales": entry[24] if len(entry) > 24 else 0,
                    "advance_amount_calc": entry[25] if len(entry) > 25 else 0,
                    "salary_amount_calc": entry[26] if len(entry) > 26 else 0,
                    
                    "created_at": entry[20] if len(entry) > 20 else None,
                    "updated_at": entry[21] if len(entry) > 21 else None
                }
                for entry in entries
            ]
        }

@app.put("/payroll/entries-v2/{entry_id}")
async def update_payroll_entry_v3(entry_id: int, entry_data: PayrollEntryUpdateV3, request: Request):
    """Обновляет запись по сотруднику в ФОТ v3"""
    async with aiosqlite.connect(DB_NAME) as db:
        # Получаем текущие данные
        cursor = await db.execute('''
            SELECT pe.*, u.role, pr.revenue
            FROM payroll_entries pe
            LEFT JOIN Users u ON pe.user_id = u.id
            LEFT JOIN payroll_reports pr ON pe.payroll_report_id = pr.id
            WHERE pe.id = ?
        ''', (entry_id,))
        
        current_entry = await cursor.fetchone()
        if not current_entry:
            raise HTTPException(status_code=404, detail="Запись не найдена")
        
        user_role = current_entry[-2]
        monthly_revenue = current_entry[-1] or 0
        
        # Строим обновление
        update_fields = []
        update_values = []
        changed_fields = {}
        
        field_mapping = {
            'monthly_tariff': (3, entry_data.monthly_tariff),
            'motivation_percent': (4, entry_data.motivation_percent),
            'motivation_tl': (5, entry_data.motivation_tl),
            'hourly_rate_tl': (8, entry_data.hourly_rate_tl),
            'actual_hours': (9, entry_data.actual_hours),  # Добавляем actual_hours
            'sales_1_15': (22, entry_data.sales_1_15),
            'sales_16_31': (23, entry_data.sales_16_31),
            'advance_expenses': (12, entry_data.advance_expenses),
            'advance_paid': (14, entry_data.advance_paid),
            'salary_expenses': (16, entry_data.salary_expenses),
            'salary_paid': (18, entry_data.salary_paid),
            'salary_comment': (19, entry_data.salary_comment)
        }
        
        for field_name, (index, new_value) in field_mapping.items():
            if new_value is not None and index < len(current_entry):
                old_value = current_entry[index]
                if old_value != new_value:
                    update_fields.append(f"{field_name} = ?")
                    update_values.append(new_value)
                    changed_fields[field_name] = {"old": old_value, "new": new_value}
        
        if not update_fields:
            return {"status": "no_changes"}
        
        # Пересчитываем автоматические поля
        motivation_percent = entry_data.motivation_percent or current_entry[4] or 0
        motivation_amount = await calculate_motivation_amount(motivation_percent, monthly_revenue)
        
        # Получаем данные для пересчета
        if user_role in ['кальянщик', 'старший кальянщик']:
            hookah_rate = await get_hookah_rate_for_role(user_role)
            advance_rate = 0
            salary_rate = 0
        else:
            advance_rate, salary_rate, _ = await get_monthly_tariff_for_role_updated(user_role)
            hookah_rate = 0
        
        current_data = {
            'role': user_role,
            'sales_1_15': entry_data.sales_1_15 or current_entry[22] or 0,
            'sales_16_31': entry_data.sales_16_31 or current_entry[23] or 0,
            'hookah_rate': hookah_rate,
            'advance_rate': advance_rate,
            'salary_rate': salary_rate,
            'motivation_amount': motivation_amount,
            'advance_expenses': entry_data.advance_expenses or current_entry[12] or 0,
            'salary_expenses': entry_data.salary_expenses or current_entry[16] or 0
        }
        
        calculated = calculate_payroll_entry_v3(current_data)
        
        # Добавляем рассчитанные поля
        calc_fields = [
            ('motivation_tl', motivation_amount),
            ('total_sales', calculated['total_sales']),
            ('advance_amount_calc', calculated['advance_amount_calc']),
            ('advance_total', calculated['advance_total']),
            ('salary_amount_calc', calculated['salary_amount_calc']),
            ('salary_total', calculated['salary_total']),
            ('monthly_total', calculated['monthly_total'])
        ]
        
        for field, value in calc_fields:
            update_fields.append(f"{field} = ?")
            update_values.append(value)
        
        update_values.append(entry_id)
        
        # Выполняем обновление
        await db.execute(f'''
            UPDATE payroll_entries 
            SET {", ".join(update_fields)}
            WHERE id = ?
        ''', update_values)
        
        # Добавляем аудит для измененных полей
        for field_name, change in changed_fields.items():
            await db.execute('''
                INSERT INTO payroll_audit_log 
                (payroll_entry_id, field_name, old_value, new_value, changed_by, change_reason)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (entry_id, field_name, str(change["old"]), str(change["new"]), 1, "Ручное редактирование v3"))
        
        await db.commit()
        return {
            "status": "updated", 
            "changed_fields": changed_fields,
            "calculated_fields": calculated
        }

# ============================================================================
# СТАРЫЕ ENDPOINTS ДЛЯ СОВМЕСТИМОСТИ (перенаправляют на новые v2)
# ============================================================================

@app.get("/payroll/reports")
async def get_payroll_reports_redirect():
    """Перенаправляет на новый endpoint"""
    return await get_payroll_reports_v2()

@app.get("/payroll/reports/{report_id}")
async def get_payroll_report_redirect(report_id: int):
    """Перенаправляет на новый endpoint"""
    return await get_payroll_report_v3(report_id)

@app.post("/payroll/generate-draft")
async def generate_payroll_draft_redirect(draft_data: PayrollGenerateDraft):
    """Перенаправляет на новую систему v2"""
    # Конвертируем старый формат в новый
    period_start = datetime.fromisoformat(draft_data.period_start[:10])
    
    new_data = PayrollReportCreateV2(
        establishment_id=draft_data.establishment_id,
        year=period_start.year,
        month=period_start.month
    )
    
    return await generate_monthly_payroll_v3(new_data)

@app.put("/payroll/reports/{report_id}")
async def update_payroll_report_v3(report_id: int, report_data: PayrollReportUpdateV3):
    """Обновляет отчет ФОТ v3"""
    async with aiosqlite.connect(DB_NAME) as db:
        # Строим динамический запрос
        update_fields = []
        update_values = []
        
        if report_data.revenue is not None:
            update_fields.append("revenue = ?")
            update_values.append(report_data.revenue)
            
        if report_data.total_sales is not None:
            update_fields.append("total_sales = ?")
            update_values.append(report_data.total_sales)
            
        if report_data.status is not None:
            update_fields.append("status = ?")
            update_values.append(report_data.status)
        
        if not update_fields:
            return {"status": "no_changes"}
            
        update_values.append(report_id)
        
        await db.execute(f'''
            UPDATE payroll_reports 
            SET {", ".join(update_fields)}
            WHERE id = ?
        ''', update_values)
        
        # Если обновили выручку - пересчитываем мотивацию всех сотрудников
        if report_data.revenue is not None:
            await recalculate_motivation_for_report(report_id, report_data.revenue)
        
        await db.commit()
        return {"status": "updated"}

async def recalculate_motivation_for_report(report_id: int, new_revenue: float):
    """Пересчитывает мотивацию для всех сотрудников в отчете"""
    async with aiosqlite.connect(DB_NAME) as db:
        # Получаем всех сотрудников в отчете
        cursor = await db.execute('''
            SELECT pe.id, pe.motivation_percent, u.role
            FROM payroll_entries pe
            LEFT JOIN Users u ON pe.user_id = u.id
            WHERE pe.payroll_report_id = ?
        ''', (report_id,))
        
        entries = await cursor.fetchall()
        
        for entry_id, motivation_percent, user_role in entries:
            if motivation_percent and motivation_percent > 0:
                # Рассчитываем новую мотивацию
                new_motivation = await calculate_motivation_amount(motivation_percent, new_revenue)
                
                # Обновляем мотивацию
                await db.execute('''
                    UPDATE payroll_entries 
                    SET motivation_tl = ?
                    WHERE id = ?
                ''', (new_motivation, entry_id))
                
                # Пересчитываем зарплату с новой мотивацией
                # TODO: здесь можно добавить полный пересчет зарплаты
        
        await db.commit()

@app.put("/payroll/entries/{entry_id}")
async def update_payroll_entry_legacy(entry_id: int, entry_data: PayrollEntryUpdate, request: Request):
    """Устаревший endpoint для обновления записи ФОТ (для совместимости)"""
    # Конвертируем в новый формат
    new_entry_data = PayrollEntryUpdateV3(
        monthly_tariff=None,  # Не поддерживается в старом формате
        motivation_percent=entry_data.motivation_percent,
        motivation_tl=None,  # Не поддерживается в старом формате
        hourly_rate_tl=None,  # Не поддерживается в старом формате
        advance_expenses=entry_data.prepaid_expense,
        advance_paid=None,  # Не поддерживается в старом формате
        salary_expenses=entry_data.housing_deduction,
        salary_paid=None,  # Не поддерживается в старом формате
        salary_comment=None  # Не поддерживается в старом формате
    )
    
    return await update_payroll_entry_v3(entry_id, new_entry_data, request)

@app.post("/payroll/reports/{report_id}/finalize")
async def finalize_payroll_report(report_id: int):
    """Финализирует отчет ФОТ"""
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute('''
            UPDATE payroll_reports 
            SET status = 'finalized'
            WHERE id = ?
        ''', (report_id,))
        
        await db.commit()
        return {"status": "finalized"}

@app.get("/payroll/entries/{entry_id}/audit")
async def get_payroll_entry_audit(entry_id: int):
    """Получает историю изменений записи ФОТ"""
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute('''
            SELECT pal.*, u.name as changed_by_name
            FROM payroll_audit_log pal
            LEFT JOIN Users u ON pal.changed_by = u.id
            WHERE pal.payroll_entry_id = ?
            ORDER BY pal.changed_at DESC
        ''', (entry_id,))
        
        audit_entries = await cursor.fetchall()
        
        return [
            {
                "id": entry[0],
                "field_name": entry[2],
                "old_value": entry[3],
                "new_value": entry[4],
                "changed_by": entry[5],
                "changed_at": entry[6],
                "change_reason": entry[7],
                "changed_by_name": entry[8] if len(entry) > 8 else None
            }
            for entry in audit_entries
        ]

# ============================================================================
# WORK PLANS - Управление планами рабочего времени
# ============================================================================

@app.get("/work-plans")
async def get_work_plans():
    """Получает все планы рабочего времени"""
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute('''
            SELECT id, role, year, month, planned_hours, planned_sales, created_at, updated_at
            FROM work_plans 
            ORDER BY year DESC, month DESC, role
        ''')
        plans = await cursor.fetchall()
        
        return [
            {
                "id": plan[0],
                "role": plan[1],
                "year": plan[2],
                "month": plan[3],
                "planned_hours": plan[4],
                "planned_sales": plan[5] if len(plan) > 5 else 0,
                "created_at": plan[6] if len(plan) > 6 else None,
                "updated_at": plan[7] if len(plan) > 7 else None
            }
            for plan in plans
        ]

@app.get("/work-plans/{year}/{month}")
async def get_work_plans_for_month(year: int, month: int):
    """Получает планы для конкретного месяца"""
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute('''
            SELECT role, planned_hours FROM work_plans 
            WHERE year = ? AND month = ?
            ORDER BY role
        ''', (year, month))
        
        plans = await cursor.fetchall()
        return {plan[0]: plan[1] for plan in plans}

@app.post("/work-plans")
async def create_work_plan(plan_data: WorkPlanCreate):
    """Создает или обновляет план рабочего времени"""
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute('''
            INSERT OR REPLACE INTO work_plans (role, year, month, planned_hours)
            VALUES (?, ?, ?, ?)
        ''', (plan_data.role, plan_data.year, plan_data.month, plan_data.planned_hours))
        
        await db.commit()
        return {"status": "created"}

@app.put("/work-plans/{role}/{year}/{month}")
async def update_work_plan(role: str, year: int, month: int, plan_data: WorkPlanUpdate):
    """Обновляет план рабочего времени"""
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute('''
            UPDATE work_plans 
            SET planned_hours = ?
            WHERE role = ? AND year = ? AND month = ?
        ''', (plan_data.planned_hours, role, year, month))
        
        await db.commit()
        return {"status": "updated"}

# ============================================================================
# ADMIN ENDPOINTS - Управление таблицами
# ============================================================================

@app.get("/tables")
async def get_tables():
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in await cursor.fetchall()]
        return tables

# Также обновите универсальный эндпоинт для таблицы Shifts
# Найдите функцию get_table_data и добавьте специальную обработку для таблицы Shifts

@app.get("/tables/{table_name}")
async def get_table_data(
    table_name: str,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=1000),
    search: str = Query(""),
    sort_by: str = Query(""),
    order: str = Query("asc")
):
    # Валидация имени таблицы
    valid_tables = ["Users", "Shifts", "Reports", "rates", "payroll_reports", 
                   "payroll_entries", "ReportsAuditLog", "ReportsEditSessions",
                   "payroll_audit_log", "work_plans", "work_schedules", 
                   "employee_schedules"]
    
    if table_name not in valid_tables:
        raise HTTPException(status_code=400, detail=f"Таблица {table_name} не найдена")
    
    try:
        async with aiosqlite.connect(DB_NAME) as db:
            # Специальная обработка для таблицы Shifts - добавляем имена пользователей
            if table_name == "Shifts":
                # Базовый запрос с JOIN для получения имён пользователей
                base_query = '''
                    SELECT 
                        s.id, 
                        s.user_id, 
                        u.name as user_name,
                        s.start_time, 
                        s.end_time, 
                        s.location, 
                        s.duration_hours, 
                        s.shift_date 
                    FROM Shifts s
                    LEFT JOIN Users u ON s.user_id = u.id
                '''
                count_query = '''
                    SELECT COUNT(*) 
                    FROM Shifts s
                    LEFT JOIN Users u ON s.user_id = u.id
                '''
            else:
                # Обычная обработка для других таблиц
                base_query = f'SELECT * FROM {table_name}'
                count_query = f'SELECT COUNT(*) FROM {table_name}'
            
            # Добавление поиска
            where_conditions = []
            search_params = []
            
            if search.strip():
                if table_name == "Shifts":
                    # Улучшенный поиск по всем полям с особой обработкой дат
                    search_param = f"%{search.strip()}%"
                    
                    # Проверяем, является ли поиск датой в формате YYYY-MM-DD
                    import re
                    is_date_search = re.match(r'^\d{4}-\d{2}-\d{2}$', search.strip())
                    
                    if is_date_search:
                        # Специальный поиск по дате - ищем в start_time, end_time и shift_date
                        search_condition = '''
                            (DATE(s.start_time) = ? OR
                            DATE(s.end_time) = ? OR
                            s.shift_date = ? OR
                            CAST(s.id AS TEXT) LIKE ? OR
                            CAST(s.user_id AS TEXT) LIKE ? OR
                            COALESCE(u.name, '') LIKE ? OR
                            COALESCE(s.location, '') LIKE ?)
                        '''
                        where_conditions.append(search_condition)
                        # Параметры: 3 раза дата + 4 раза LIKE паттерн
                        search_params = [search.strip()] * 3 + [search_param] * 4
                    else:
                        # Обычный поиск по всем полям
                        search_condition = '''
                            (CAST(s.id AS TEXT) LIKE ? OR
                            CAST(s.user_id AS TEXT) LIKE ? OR
                            COALESCE(u.name, '') LIKE ? OR
                            COALESCE(s.start_time, '') LIKE ? OR
                            COALESCE(s.end_time, '') LIKE ? OR
                            COALESCE(s.location, '') LIKE ? OR
                            CAST(COALESCE(s.duration_hours, 0) AS TEXT) LIKE ? OR
                            COALESCE(s.shift_date, '') LIKE ?)
                        '''
                        where_conditions.append(search_condition)
                        # 8 параметров поиска
                        search_params = [search_param] * 8
                else:
                    # Обычная обработка для других таблиц (без изменений)
                    cursor = await db.execute(f"PRAGMA table_info({table_name})")
                    columns_info = await cursor.fetchall()
                    columns = [col[1] for col in columns_info]
                    
                    search_conditions = [f"CAST({col} AS TEXT) LIKE ?" for col in columns]
                    where_conditions.append(f"({' OR '.join(search_conditions)})")
                    search_params = [f"%{search.strip()}%"] * len(columns)
            
            # Формируем WHERE clause
            where_clause = ""
            if where_conditions:
                where_clause = " WHERE " + " AND ".join(where_conditions)
            
            # Подсчёт общего количества записей
            count_cursor = await db.execute(count_query + where_clause, search_params)
            total = (await count_cursor.fetchone())[0]
            
            # Сортировка
            order_clause = ""
            if sort_by:
                order_direction = "ASC" if order.upper() == "ASC" else "DESC"
                if table_name == "Shifts":
                    # Для таблицы Shifts используем алиасы
                    sort_column = sort_by
                    if sort_by == "user_name":
                        sort_column = "u.name"
                    elif sort_by in ["id", "user_id", "start_time", "end_time", "location", "duration_hours", "shift_date"]:
                        sort_column = f"s.{sort_by}"
                else:
                    sort_column = sort_by
                order_clause = f" ORDER BY {sort_column} {order_direction}"
            else:
                # Сортировка по умолчанию
                if table_name == "Shifts":
                    order_clause = " ORDER BY s.start_time DESC"
                else:
                    order_clause = " ORDER BY id DESC"
            
            # Пагинация
            offset = (page - 1) * page_size
            limit_clause = f" LIMIT {page_size} OFFSET {offset}"
            
            # Выполняем основной запрос
            final_query = base_query + where_clause + order_clause + limit_clause
            cursor = await db.execute(final_query, search_params)
            rows = await cursor.fetchall()
            
            # Формируем результат
            if table_name == "Shifts":
                # Специальное формирование данных для Shifts
                data = []
                for row in rows:
                    data.append({
                        "id": row[0],
                        "user_id": row[1], 
                        "user_name": row[2] if row[2] else f"ID: {row[1]}",
                        "start_time": row[3],
                        "end_time": row[4], 
                        "location": row[5],
                        "duration_hours": row[6],
                        "shift_date": row[7]
                    })
            else:
                # Получаем имена колонок для обычных таблиц
                cursor = await db.execute(f"PRAGMA table_info({table_name})")
                columns_info = await cursor.fetchall()
                columns = [col[1] for col in columns_info]
                
                data = []
                for row in rows:
                    row_dict = {}
                    for i, column in enumerate(columns):
                        row_dict[column] = row[i] if i < len(row) else None
                    data.append(row_dict)
            
            # Расчёт количества страниц
            pages = (total + page_size - 1) // page_size
            
            return {
                "data": data,
                "total": total,
                "page": page,
                "pages": pages,
                "page_size": page_size
            }
    
    except Exception as e:
        print(f"❌ Ошибка получения данных таблицы {table_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Ошибка получения данных: {str(e)}")

# @app.get("/tables/{table_name}")
# async def get_table_data(table_name: str, page: int = 1, page_size: int = 25, search: str = ""):
#     offset = (page - 1) * page_size
#     async with aiosqlite.connect(DB_NAME) as db:
#         where_clause = ""
#         values = []
#         if search:
#             column_info = await db.execute(f"PRAGMA table_info({table_name})")
#             columns = [col[1] for col in await column_info.fetchall()]
#             where_clause = "WHERE " + " OR ".join([f"{col} LIKE ?" for col in columns])
#             values = [f"%{search}%" for _ in columns]
        
#         count_cursor = await db.execute(f"SELECT COUNT(*) FROM {table_name} {where_clause}", values)
#         total_rows = (await count_cursor.fetchone())[0]

#         cursor = await db.execute(f"SELECT * FROM {table_name} {where_clause} LIMIT ? OFFSET ?", values + [page_size, offset])
#         columns = [description[0] for description in cursor.description]
#         rows = await cursor.fetchall()
        
#         return {
#             "data": [dict(zip(columns, row)) for row in rows],
#             "total": total_rows,
#             "pages": math.ceil(total_rows / page_size) if total_rows > 0 else 0,
#             "page": page
#         }

@app.post("/tables/{table_name}")
async def insert_table_data(table_name: str, data: Dict[str, Any]):
    keys = ", ".join(data.keys())
    placeholders = ", ".join(["?" for _ in data.values()])
    values = list(data.values())
    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute(f"INSERT INTO {table_name} ({keys}) VALUES ({placeholders})", values)
        await db.commit()
    return {"status": "success"}

@app.put("/tables/{table_name}")
async def update_table_data(table_name: str, request: Request):
    body = await request.json()
    updates = body.get("updates", [])
    
    # Определяем виртуальные колонки, которые нельзя обновлять
    virtual_columns = {
        'Shifts': ['user_name'],  # user_name - это JOIN с таблицей Users
        'Reports': ['user_name'],  # если есть в Reports
        # Добавьте другие виртуальные колонки здесь
    }
    
    async with aiosqlite.connect(DB_NAME) as db:
        for update in updates:
            original = update["original"]
            changes = update["changes"]
            
            # Фильтруем виртуальные колонки
            if table_name in virtual_columns:
                filtered_changes = {}
                for key, value in changes.items():
                    if key not in virtual_columns[table_name]:
                        filtered_changes[key] = value
                    else:
                        print(f"⚠️ Пропускаем виртуальную колонку {key} для таблицы {table_name}")
                
                changes = filtered_changes
            
            # Если после фильтрации нет изменений, пропускаем
            if not changes:
                print(f"ℹ️ Нет реальных изменений для обновления в таблице {table_name}")
                continue
            
            set_clause = ", ".join([f"{key} = ?" for key in changes.keys()])
            
            # Обработка NULL значений в WHERE
            where_conditions = []
            where_values = []
            
            for key, value in original.items():
                # Пропускаем виртуальные колонки в WHERE тоже
                if table_name in virtual_columns and key in virtual_columns[table_name]:
                    continue
                    
                if value is None:
                    where_conditions.append(f"{key} IS NULL")
                else:
                    where_conditions.append(f"{key} = ?")
                    where_values.append(value)
            
            where_clause = " AND ".join(where_conditions)
            values = list(changes.values()) + where_values
            
            print(f"🔧 Обновляем {table_name}: SET {set_clause} WHERE {where_clause}")
            print(f"📊 Значения: {values}")
            
            await db.execute(f"UPDATE {table_name} SET {set_clause} WHERE {where_clause}", values)
        
        await db.commit()
    
    return {"status": "success"}

@app.delete("/tables/{table_name}")
async def delete_row(table_name: str, row: dict):
    if "id" not in row:
        raise HTTPException(status_code=400, detail="Missing id field for deletion")

    async with aiosqlite.connect(DB_NAME) as db:
        await db.execute(f"DELETE FROM {table_name} WHERE id = ?", (row["id"],))
        await db.commit()

    return {"message": "Row deleted successfully"}

# ============================================================================
# ENDPOINTS ДЛЯ РАБОТЫ С ТАРИФАМИ
# ============================================================================

@app.get("/rates/monthly-totals")
async def get_rates_with_monthly_totals():
    """Получает тарифы с месячными итогами"""
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute('''
            SELECT role, effective_date, 
                   SUM(CASE WHEN period_type = '1-15' THEN rate ELSE 0 END) as advance_rate,
                   SUM(CASE WHEN period_type = '16-end' THEN rate ELSE 0 END) as salary_rate,
                   SUM(CASE WHEN period_type IN ('1-15', '16-end') THEN rate ELSE 0 END) as monthly_total,
                   MAX(CASE WHEN period_type = 'per_hookah' THEN rate ELSE 0 END) as hookah_rate
            FROM rates 
            GROUP BY role, effective_date
            HAVING advance_rate > 0 OR salary_rate > 0 OR hookah_rate > 0
            ORDER BY role, effective_date DESC
        ''')
        
        rates = await cursor.fetchall()
        
        return [
            {
                "role": rate[0],
                "effective_date": rate[1],
                "advance_rate": rate[2],
                "salary_rate": rate[3],
                "monthly_total": rate[4],
                "hookah_rate": rate[5]
            }
            for rate in rates
        ]

#ФИЛЬТРАЦИЯ ПО ЗАВЕДЕНИЯМ для EmployeeShedules
# Добавить в main.py после других API endpoints

@app.get("/users-by-location/{location}")
async def get_users_by_location(location: str):
    """Получает список пользователей, которые работали в указанном заведении"""
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute('''
            SELECT DISTINCT u.id, u.name, u.status, u.role, u.telegram_id
            FROM Users u
            JOIN Shifts s ON u.id = s.user_id
            WHERE s.location = ? AND u.status = 'active'
            ORDER BY u.name
        ''', (location,))
        
        rows = await cursor.fetchall()
        users = []
        for row in rows:
            users.append({
                "id": row[0],
                "name": row[1], 
                "status": row[2],
                "role": row[3],
                "telegram_id": row[4]
            })
        
        return users

@app.get("/locations")
async def get_all_locations():
    """Получает список всех заведений"""
    async with aiosqlite.connect(DB_NAME) as db:
        cursor = await db.execute('''
            SELECT DISTINCT location 
            FROM Shifts 
            WHERE location IS NOT NULL AND location != ''
            ORDER BY location
        ''')
        
        rows = await cursor.fetchall()
        locations = [row[0] for row in rows]
        
        return locations

# ============================================================================
# STARTUP & CACHE MANAGEMENT
# ============================================================================

@app.on_event("startup")
async def startup_event():
    """Инициализация при запуске сервера"""
    print("🚀 Сервер ФОТ v3.0 запускается...")
    print("✅ Все endpoints готовы к работе!")

# Cache management endpoint
@app.post("/admin/clear-cache")
async def clear_cache():
    """Очищает кеши для принудительного обновления"""
    global _rates_cache, _rates_cache_timestamp
    _rates_cache = {}
    _rates_cache_timestamp = None
    return {"status": "cache_cleared", "message": "Кеш тарифов очищен"}

if __name__ == "__main__":
    import uvicorn
    print("🚀 Запуск FastAPI сервера...")
    print("📡 API будет доступен по адресу: http://66.151.43.24:8000")
    print("📚 Документация: http://66.151.43.24:8000/docs")
    print("💰 ФОТ v3.0 endpoints готовы!")
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)