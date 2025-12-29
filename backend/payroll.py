import re
from typing import List, Dict, Any, Optional, Tuple
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from .database import get_db

router = APIRouter()

# --- МОДЕЛИ ДАННЫХ ---
class PayrollReportCreateV2(BaseModel):
    establishment_id: int
    year: int
    month: int
    revenue: Optional[float] = 0

class PayrollEntryUpdateV2(BaseModel):
    monthly_tariff: Optional[float] = 0
    motivation_percent: Optional[float] = 0
    motivation_tl: Optional[float] = 0
    hourly_rate_tl: Optional[float] = 0
    actual_hours: Optional[float] = 0
    sales_1_15: Optional[int] = 0
    sales_16_31: Optional[int] = 0
    advance_expenses: Optional[float] = 0
    advance_paid: Optional[bool] = False
    salary_expenses: Optional[float] = 0
    salary_paid: Optional[bool] = False
    salary_comment: Optional[str] = ""

class ReportUpdate(BaseModel):
    revenue: Optional[float]

# --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---

async def get_missed_days_off(db, user_id: int, year: int, month: int) -> int:
    """Считает дни, когда сотрудник работал в свой выходной"""
    shifts_query = '''
        SELECT DISTINCT CAST(strftime('%d', start_time) AS INTEGER) as day
        FROM Shifts 
        WHERE user_id = ? 
        AND strftime('%Y', start_time) = ? 
        AND strftime('%m', start_time) = ?
    '''
    cursor = await db.execute(shifts_query, (user_id, str(year), f"{month:02d}"))
    worked_days = {row['day'] for row in await cursor.fetchall()}

    schedule_query = '''
        SELECT day FROM employee_schedules
        WHERE user_id = ? AND year = ? AND month = ? AND is_workday = 1
    '''
    cursor = await db.execute(schedule_query, (user_id, year, month))
    planned_work_days = {row['day'] for row in await cursor.fetchall()}
    
    # Переработка = Работал, но дня нет в planned_work_days (выходной)
    missed_days = 0
    for day in worked_days:
        if day not in planned_work_days:
            missed_days += 1
            
    return missed_days

async def parse_sales_from_reports(establishment_location: str, year: int, month: int) -> Tuple[int, int, int]:
    async with await get_db() as db:
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

# --- ЭНДПОИНТЫ ---

@router.get("/payroll/reports") 
@router.get("/payroll/reports-v2")
async def get_payroll_reports_v2():
    async with await get_db() as db:
        c = await db.execute("SELECT * FROM payroll_reports ORDER BY created_at DESC")
        return [dict(r) for r in await c.fetchall()]

@router.get("/payroll/reports-v2/{report_id}")
async def get_payroll_report_details_v2(report_id: int):
    async with await get_db() as db:
        cursor = await db.execute("SELECT * FROM payroll_reports WHERE id = ?", (report_id,))
        report = await cursor.fetchone()
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
            
        cursor = await db.execute('''
            SELECT pe.*, u.name as user_name, u.role as user_role
            FROM payroll_entries pe
            LEFT JOIN Users u ON pe.user_id = u.id
            WHERE pe.payroll_report_id = ?
        ''', (report_id,))
        entries = [dict(row) for row in await cursor.fetchall()]
        
        return {"report": dict(report), "entries": entries}

@router.post("/payroll/generate-monthly")
async def generate_monthly_payroll_v3(draft_data: PayrollReportCreateV2):
    async with await get_db() as db:
        try:
            # 1. Создание отчета
            cursor = await db.execute('''
                INSERT INTO payroll_reports (establishment_id, year, month, created_by, status, revenue)
                VALUES (?, ?, ?, ?, 'draft', ?)
            ''', (draft_data.establishment_id, draft_data.year, draft_data.month, 1, draft_data.revenue))
            report_id = cursor.lastrowid
            
            loc = "Yenibosna" if draft_data.establishment_id == 1 else "Göktürk"
            
            # 2. Продажи
            s15, s31, total_sales = await parse_sales_from_reports(loc, draft_data.year, draft_data.month)
            await db.execute("UPDATE payroll_reports SET total_sales = ? WHERE id = ?", (total_sales, report_id))
            
            # 3. Сотрудники
            month_str = f"{draft_data.month:02d}"
            cursor = await db.execute('''
                SELECT DISTINCT u.id, u.name, u.role 
                FROM Users u
                JOIN Shifts s ON u.id = s.user_id
                WHERE s.location = ? 
                AND strftime('%Y', s.shift_date) = ? 
                AND strftime('%m', s.shift_date) = ?
            ''', (loc, str(draft_data.year), month_str))
            users = await cursor.fetchall()
            
            for u in users:
                # 4. План часов
                cursor_plan = await db.execute(
                    "SELECT planned_hours FROM role_work_plans WHERE role = ? AND year = ? AND month = ?",
                    (u['role'], draft_data.year, draft_data.month)
                )
                plan_row = await cursor_plan.fetchone()
                planned_hours = plan_row['planned_hours'] if plan_row else 160
                
                # 5. Факт часы
                cursor_hours = await db.execute('''
                    SELECT SUM(duration_hours) as total_hours 
                    FROM Shifts 
                    WHERE user_id = ? AND strftime('%Y', shift_date) = ? AND strftime('%m', shift_date) = ?
                ''', (u['id'], str(draft_data.year), month_str))
                hours_row = await cursor_hours.fetchone()
                actual_hours = hours_row['total_hours'] if hours_row and hours_row['total_hours'] else 0

                # 6. Переработки
                missed_days = await get_missed_days_off(db, u['id'], draft_data.year, draft_data.month)
                overtime_pay = missed_days * 500 
                
                calc_total = 0 
                if "кальянщик" in u['role'].lower():
                    calc_total = (s15 + s31) * 15
                
                await db.execute('''
                    INSERT INTO payroll_entries (
                        payroll_report_id, user_id, role, 
                        sales_1_15, sales_16_31, total_sales,
                        missed_days_off, overtime_pay,
                        actual_hours,
                        monthly_total,
                        created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                ''', (
                    report_id, u['id'], u['role'], 
                    s15, s31, (s15 + s31),
                    missed_days, overtime_pay,
                    actual_hours,
                    calc_total
                ))
            
            await db.commit()
            return {"report_id": report_id, "status": "created", "total_sales": total_sales, "employees_count": len(users)}
            
        except Exception as e:
            await db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

@router.put("/payroll/entries-v2/{entry_id}")
async def update_payroll_entry_v2(entry_id: int, data: PayrollEntryUpdateV2):
    async with await get_db() as db:
        try:
            total_sales = (data.sales_1_15 or 0) + (data.sales_16_31 or 0)
            await db.execute('''
                UPDATE payroll_entries SET
                    monthly_tariff = ?, motivation_percent = ?, motivation_tl = ?,
                    hourly_rate_tl = ?, actual_hours = ?,
                    sales_1_15 = ?, sales_16_31 = ?, total_sales = ?,
                    advance_expenses = ?, advance_paid = ?,
                    salary_expenses = ?, salary_paid = ?, salary_comment = ?,
                    updated_at = datetime('now')
                WHERE id = ?
            ''', (
                data.monthly_tariff, data.motivation_percent, data.motivation_tl,
                data.hourly_rate_tl, data.actual_hours,
                data.sales_1_15, data.sales_16_31, total_sales,
                data.advance_expenses, data.advance_paid,
                data.salary_expenses, data.salary_paid, data.salary_comment,
                entry_id
            ))
            await db.commit()
            return {"status": "updated"}
        except Exception as e:
            await db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

@router.put("/payroll/reports/{report_id}")
async def update_report_meta(report_id: int, data: ReportUpdate):
    async with await get_db() as db:
        await db.execute("UPDATE payroll_reports SET revenue = ? WHERE id = ?", (data.revenue, report_id))
        await db.commit()
        return {"status": "updated"}

@router.post("/payroll/reports/{report_id}/finalize")
async def finalize_report(report_id: int):
    async with await get_db() as db:
        await db.execute("UPDATE payroll_reports SET status = 'finalized' WHERE id = ?", (report_id,))
        await db.commit()
        return {"status": "finalized"}