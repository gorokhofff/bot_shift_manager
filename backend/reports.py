import json
import re
from datetime import datetime, date
from typing import Optional, Dict, Any, List
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from .database import get_db

router = APIRouter()

# --- МОДЕЛИ ---
class ReportUpdateModel(BaseModel):
    report_text: str
    change_reason: Optional[str] = "Редактирование через API"
    changed_fields: Optional[Dict[str, Any]] = None

# --- ЭНДПОИНТЫ ДЛЯ ДАШБОРДА (ГРАФИКИ) ---

@router.get("/dashboard/sales-stats")
async def get_dashboard_sales_stats(
    year: Optional[int] = Query(None), 
    month: Optional[int] = Query(None)
):
    async with await get_db() as db:
        # Текущая реальная дата для логики "неполного месяца"
        real_now = datetime.now()
        
        # Если параметры не переданы, берем текущую дату
        if year and month:
            target_year, target_month = year, month
        else:
            target_year, target_month = real_now.year, real_now.month
        
        # Определяем "прошлый" месяц относительно ВЫБРАННОГО
        if target_month == 1:
            prev_month = 12
            prev_year = target_year - 1
        else:
            prev_month = target_month - 1
            prev_year = target_year

        # ЛОГИКА СРАВНЕНИЯ (MTD - Month to Date)
        # Если мы смотрим текущий месяц, то прошлый месяц нужно обрезать по текущий день.
        # Если мы смотрим архивный месяц, сравниваем полные месяцы.
        is_ongoing_month = (target_year == real_now.year and target_month == real_now.month)
        limit_day = real_now.day if is_ongoing_month else 32 # 32 значит "берем всё"

        # Запрос к БД за оба месяца
        query = '''
            SELECT r.report_text, r.created_at, s.location 
            FROM Reports r
            JOIN Shifts s ON r.shift_id = s.id
            WHERE (strftime('%Y', r.created_at) = ? AND strftime('%m', r.created_at) = ?)
               OR (strftime('%Y', r.created_at) = ? AND strftime('%m', r.created_at) = ?)
        '''
        
        cursor = await db.execute(query, (
            str(target_year), f"{target_month:02d}",
            str(prev_year), f"{prev_month:02d}"
        ))
        rows = await cursor.fetchall()

        daily_data = {} # { day: { Yenibosna: 0, Göktürk: 0 } }
        totals = {
            "current": {"Yenibosna": 0, "Göktürk": 0},
            "prev": {"Yenibosna": 0, "Göktürk": 0}
        }

        for row in rows:
            text = row['report_text']
            if not text: continue
            
            # 1. Парсим Продажи (с защитой от ___)
            sales_match = re.search(r'satış\s*-\s*[_\s]*(\d+)', text, re.IGNORECASE)
            if not sales_match: continue
            count = int(sales_match.group(1))
            
            # 2. Парсим Локацию
            location = row['location']
            if not location: continue

            # 3. Безопасный парсинг даты создания
            raw_date = row['created_at']
            if not raw_date: continue
            clean_date_str = raw_date.split('.')[0].replace('T', ' ')

            try:
                created_at_dt = datetime.strptime(clean_date_str, "%Y-%m-%d %H:%M:%S")
            except ValueError:
                try:
                    created_at_dt = datetime.strptime(clean_date_str, "%Y-%m-%d")
                except ValueError:
                    continue
            
            # 4. Поиск даты внутри текста отчета (tarih - 5)
            # Используем улучшенный Regex
            date_match = re.search(r'tarih\s*-\s*[_\s]*(\d{1,2})', text, re.IGNORECASE)
            
            report_day = created_at_dt.day
            report_month = created_at_dt.month
            report_year = created_at_dt.year

            if date_match:
                parsed_day = int(date_match.group(1))
                # Коррекция месяца, если отчет сдан 1-го числа за 30-е
                if parsed_day > report_day + 15: 
                     if report_month == 1:
                         report_month = 12
                         report_year -= 1
                     else:
                         report_month -= 1
                
                report_day = parsed_day

            # 5. Агрегация с учетом MTD (Month to Date)
            is_target_month = (report_year == target_year and report_month == target_month)
            is_prev_month = (report_year == prev_year and report_month == prev_month)

            if is_target_month:
                # В текущем месяце суммируем всё (будущих дат там и так нет)
                if location in totals["current"]: totals["current"][location] += count
                
                # Данные для графика
                if report_day not in daily_data:
                    daily_data[report_day] = {"Yenibosna": 0, "Göktürk": 0}
                if location in daily_data[report_day]:
                    daily_data[report_day][location] += count

            elif is_prev_month:
                # В прошлом месяце суммируем ТОЛЬКО если день <= сегодняшнего (если месяц неполный)
                # Если месяц полный (архивный), limit_day = 32, поэтому условие всегда True
                if report_day <= limit_day:
                    if location in totals["prev"]: totals["prev"][location] += count

        # 6. Формируем массив для графика
        chart_data = []
        for d in sorted(daily_data.keys()):
            chart_data.append({
                "day": d,
                "Yenibosna": daily_data[d]["Yenibosna"],
                "Göktürk": daily_data[d]["Göktürk"]
            })

        return {
            "totals": totals,
            "chart": chart_data
        }

# --- ОСНОВНЫЕ ЭНДПОИНТЫ ОТЧЕТОВ ---

@router.get("/reports")
async def get_reports():
    async with await get_db() as db:
        query = '''
            SELECT r.*, u.name as user_name, u.id as user_id
            FROM Reports r 
            LEFT JOIN Shifts s ON r.shift_id = s.id
            LEFT JOIN Users u ON s.user_id = u.id 
            ORDER BY r.created_at DESC
        '''
        cursor = await db.execute(query)
        return [dict(row) for row in await cursor.fetchall()]

@router.put("/reports/{report_id}")
async def update_report(report_id: int, data: ReportUpdateModel):
    async with await get_db() as db:
        cursor = await db.execute("SELECT * FROM Reports WHERE id = ?", (report_id,))
        old_report = await cursor.fetchone()
        if not old_report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        old_text = old_report['report_text']
        
        try:
            await db.execute(
                "UPDATE Reports SET report_text = ?, updated_at = datetime('now', 'localtime') WHERE id = ?", 
                (data.report_text, report_id)
            )
            
            changed_fields_json = json.dumps(data.changed_fields, ensure_ascii=False) if data.changed_fields else None
            admin_user_id = 1 
            
            await db.execute('''
                INSERT INTO reports_audit (
                    report_id, version, previous_text, new_text, 
                    change_reason, changed_fields, action_type, user_id
                ) VALUES (?, (SELECT COALESCE(MAX(version), 0) + 1 FROM reports_audit WHERE report_id = ?), ?, ?, ?, ?, 'UPDATE', ?)
            ''', (
                report_id, report_id, 
                old_text, data.report_text, 
                data.change_reason, changed_fields_json,
                admin_user_id
            ))
            
            await db.commit()
            return {"status": "success", "id": report_id}
            
        except Exception as e:
            await db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

@router.delete("/reports/{report_id}")
async def delete_report(report_id: int):
    async with await get_db() as db:
        try:
            # Сначала проверяем, существует ли отчет
            cursor = await db.execute("SELECT id FROM Reports WHERE id = ?", (report_id,))
            if not await cursor.fetchone():
                raise HTTPException(status_code=404, detail="Report not found")

            # Удаляем записи из аудита
            await db.execute("DELETE FROM reports_audit WHERE report_id = ?", (report_id,))
            
            # Удаляем сам отчет
            await db.execute("DELETE FROM Reports WHERE id = ?", (report_id,))
            
            await db.commit()
            return {"status": "deleted", "id": report_id}
        except Exception as e:
            await db.rollback()
            raise HTTPException(status_code=500, detail=str(e))

@router.get("/reports/{report_id}/audit")
async def get_report_audit(report_id: int):
    async with await get_db() as db:
        try:
            cursor = await db.execute('''
                SELECT ra.*, u.name as user_name 
                FROM reports_audit ra
                LEFT JOIN Users u ON ra.user_id = u.id
                WHERE ra.report_id = ? 
                ORDER BY ra.created_at DESC
            ''', (report_id,))
            return [dict(row) for row in await cursor.fetchall()]
        except Exception as e:
            return []