#!/usr/bin/env python3
"""
Скрипт для проверки структуры базы данных и миграции v2
"""

import asyncio
import aiosqlite
import sys
from datetime import datetime

DB_NAME = "../shift_manager.db"

async def check_database_structure():
    """Проверяет текущую структуру базы данных"""
    print("🔍 Проверяем структуру базы данных...")
    
    try:
        async with aiosqlite.connect(DB_NAME) as db:
            # Проверяем все таблицы
            cursor = await db.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = [row[0] for row in await cursor.fetchall()]
            print(f"📋 Найденные таблицы: {tables}")
            
            # Проверяем структуру payroll_reports
            if 'payroll_reports' in tables:
                print("\n📊 Структура payroll_reports:")
                cursor = await db.execute("PRAGMA table_info(payroll_reports)")
                columns = await cursor.fetchall()
                for col in columns:
                    print(f"  - {col[1]} ({col[2]}) {'NOT NULL' if col[3] else 'NULL'}")
                
                # Проверяем данные в таблице
                cursor = await db.execute("SELECT COUNT(*) FROM payroll_reports")
                count = (await cursor.fetchone())[0]
                print(f"  📈 Записей в таблице: {count}")
            else:
                print("❌ Таблица payroll_reports не найдена!")
            
            # Проверяем структуру payroll_entries
            if 'payroll_entries' in tables:
                print("\n👥 Структура payroll_entries:")
                cursor = await db.execute("PRAGMA table_info(payroll_entries)")
                columns = await cursor.fetchall()
                for col in columns:
                    print(f"  - {col[1]} ({col[2]}) {'NOT NULL' if col[3] else 'NULL'}")
                
                cursor = await db.execute("SELECT COUNT(*) FROM payroll_entries")
                count = (await cursor.fetchone())[0]
                print(f"  📈 Записей в таблице: {count}")
            else:
                print("❌ Таблица payroll_entries не найдена!")
            
            # Проверяем work_plans
            if 'work_plans' in tables:
                print("\n📅 Таблица work_plans найдена ✅")
                cursor = await db.execute("SELECT COUNT(*) FROM work_plans")
                count = (await cursor.fetchone())[0]
                print(f"  📈 Записей в таблице: {count}")
            else:
                print("❌ Таблица work_plans не найдена!")
            
            # Проверяем rates
            if 'rates' in tables:
                print("\n💰 Структура rates:")
                cursor = await db.execute("PRAGMA table_info(rates)")
                columns = await cursor.fetchall()
                for col in columns:
                    print(f"  - {col[1]} ({col[2]}) {'NOT NULL' if col[3] else 'NULL'}")
            
            return tables
            
    except Exception as e:
        print(f"❌ Ошибка проверки БД: {e}")
        return []

async def check_migration_status():
    """Проверяет статус миграции v2"""
    print("\n🔍 Проверяем статус миграции v2...")
    
    try:
        async with aiosqlite.connect(DB_NAME) as db:
            # Проверяем наличие новых полей
            cursor = await db.execute("PRAGMA table_info(payroll_reports)")
            payroll_columns = [row[1] for row in await cursor.fetchall()]
            
            has_year_month = 'year' in payroll_columns and 'month' in payroll_columns
            has_old_fields = 'period_start' in payroll_columns and 'period_end' in payroll_columns
            
            print(f"📊 Поля payroll_reports:")
            print(f"  - year/month: {'✅' if has_year_month else '❌'}")
            print(f"  - period_start/end: {'✅' if has_old_fields else '❌'}")
            
            # Проверяем payroll_entries
            cursor = await db.execute("PRAGMA table_info(payroll_entries)")
            entry_columns = [row[1] for row in await cursor.fetchall()]
            
            has_v2_fields = 'monthly_tariff' in entry_columns and 'advance_amount' in entry_columns
            has_old_fields_entry = 'base_salary' in entry_columns and 'final_payment' in entry_columns
            
            print(f"👥 Поля payroll_entries:")
            print(f"  - v2 поля (monthly_tariff, advance_amount): {'✅' if has_v2_fields else '❌'}")
            print(f"  - старые поля (base_salary, final_payment): {'✅' if has_old_fields_entry else '❌'}")
            
            # Проверяем work_plans
            cursor = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='work_plans'")
            has_work_plans = await cursor.fetchone() is not None
            print(f"📅 Таблица work_plans: {'✅' if has_work_plans else '❌'}")
            
            # Итоговый статус
            if has_year_month and has_v2_fields and has_work_plans:
                print("\n🎉 Миграция v2 ЗАВЕРШЕНА!")
                return True
            elif has_old_fields and has_old_fields_entry:
                print("\n⚠️ Миграция v2 НЕ ВЫПОЛНЕНА - используется старая структура")
                return False
            else:
                print("\n❓ Смешанное состояние - частично мигрировано")
                return False
                
    except Exception as e:
        print(f"❌ Ошибка проверки миграции: {e}")
        return False

async def quick_fix_database():
    """Быстрое исправление структуры БД для v2"""
    print("\n🔧 Применяем быстрое исправление для v2...")
    
    try:
        async with aiosqlite.connect(DB_NAME) as db:
            # Создаем резервную копию
            backup_name = f"../shift_manager_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
            import shutil
            shutil.copy2(DB_NAME, backup_name)
            print(f"💾 Резервная копия: {backup_name}")
            
            # Проверяем текущую структуру
            cursor = await db.execute("PRAGMA table_info(payroll_reports)")
            current_columns = [row[1] for row in await cursor.fetchall()]
            
            if 'year' not in current_columns:
                print("➕ Добавляем поля year и month...")
                await db.execute("ALTER TABLE payroll_reports ADD COLUMN year INTEGER")
                await db.execute("ALTER TABLE payroll_reports ADD COLUMN month INTEGER")
                
                # Если есть старые записи, пытаемся конвертировать
                cursor = await db.execute("SELECT COUNT(*) FROM payroll_reports")
                count = (await cursor.fetchone())[0]
                
                if count > 0:
                    print(f"🔄 Конвертируем {count} существующих записей...")
                    cursor = await db.execute("SELECT id, period_start FROM payroll_reports WHERE period_start IS NOT NULL")
                    records = await cursor.fetchall()
                    
                    for record_id, period_start in records:
                        try:
                            date_obj = datetime.fromisoformat(period_start[:10])
                            await db.execute("""
                                UPDATE payroll_reports 
                                SET year = ?, month = ? 
                                WHERE id = ?
                            """, (date_obj.year, date_obj.month, record_id))
                        except:
                            # Если не удается распарсить дату, ставим текущую
                            now = datetime.now()
                            await db.execute("""
                                UPDATE payroll_reports 
                                SET year = ?, month = ? 
                                WHERE id = ?
                            """, (now.year, now.month, record_id))
            
            # Создаем work_plans если нет
            await db.execute("""
                CREATE TABLE IF NOT EXISTS work_plans (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    role TEXT NOT NULL,
                    year INTEGER NOT NULL,
                    month INTEGER NOT NULL,
                    planned_hours REAL NOT NULL,
                    created_at TEXT DEFAULT (datetime('now', 'localtime')),
                    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
                    UNIQUE(role, year, month)
                )
            """)
            
            # Добавляем базовые планы
            current_year = datetime.now().year
            current_month = datetime.now().month
            
            roles_hours = [
                ('кальянщик', 160),
                ('старший кальянщик', 180),
                ('администратор', 170),
                ('уборщик', 160),
                ('студент', 120),
                ('бармен/зал', 160)
            ]
            
            for role, hours in roles_hours:
                await db.execute("""
                    INSERT OR IGNORE INTO work_plans (role, year, month, planned_hours)
                    VALUES (?, ?, ?, ?)
                """, (role, current_year, current_month, hours))
            
            # Проверяем и обновляем payroll_entries
            cursor = await db.execute("PRAGMA table_info(payroll_entries)")
            entry_columns = [row[1] for row in await cursor.fetchall()]
            
            v2_fields = [
                ('monthly_tariff', 'REAL DEFAULT 0'),
                ('motivation_tl', 'REAL DEFAULT 0'),
                ('monthly_income', 'REAL DEFAULT 0'),
                ('planned_hours', 'REAL DEFAULT 0'),
                ('hourly_rate_tl', 'REAL DEFAULT 0'),
                ('actual_hours', 'REAL DEFAULT 0'),
                ('monthly_total', 'REAL DEFAULT 0'),
                ('advance_amount', 'REAL DEFAULT 0'),
                ('advance_expenses', 'REAL DEFAULT 0'),
                ('advance_total', 'REAL DEFAULT 0'),
                ('advance_paid', 'BOOLEAN DEFAULT FALSE'),
                ('salary_remainder', 'REAL DEFAULT 0'),
                ('salary_expenses', 'REAL DEFAULT 0'),
                ('salary_total', 'REAL DEFAULT 0'),
                ('salary_paid', 'BOOLEAN DEFAULT FALSE'),
                ('salary_comment', 'TEXT DEFAULT ""')
            ]
            
            for field_name, field_type in v2_fields:
                if field_name not in entry_columns:
                    print(f"➕ Добавляем поле {field_name}...")
                    await db.execute(f"ALTER TABLE payroll_entries ADD COLUMN {field_name} {field_type}")
            
            await db.commit()
            print("✅ Быстрое исправление применено!")
            
            return True
            
    except Exception as e:
        print(f"❌ Ошибка исправления БД: {e}")
        return False

async def main():
    """Основная функция"""
    print("🔍 Диагностика базы данных ФОТ v2.0")
    print("=" * 50)
    
    # Проверяем структуру
    tables = await check_database_structure()
    
    if not tables:
        print("❌ Не удалось подключиться к базе данных!")
        return
    
    # Проверяем статус миграции
    is_migrated = await check_migration_status()
    
    if not is_migrated:
        print("\n🛠️ Необходимо применить миграцию v2!")
        
        answer = input("Применить быстрое исправление? (y/N): ").lower().strip()
        if answer == 'y':
            success = await quick_fix_database()
            if success:
                print("\n🎉 База данных обновлена для v2!")
                print("🔄 Перезапустите сервер для применения изменений")
            else:
                print("❌ Не удалось обновить базу данных")
        else:
            print("❌ Исправление отменено")
            print("\n📝 Для ручной миграции используйте:")
            print("   python migration_v2_complete.py")
    else:
        print("\n✅ База данных готова для работы с v2!")

if __name__ == "__main__":
    asyncio.run(main())