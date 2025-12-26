#!/usr/bin/env python3
"""
Миграция ФОТ системы в версию 2.0
Переход на месячную систему расчета
"""

import asyncio
import aiosqlite
import sys
from datetime import datetime

DB_NAME = "../shift_manager.db"

async def backup_database():
    """Создает резервную копию базы данных"""
    import shutil
    
    backup_name = f"../shift_manager_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
    try:
        shutil.copy2(DB_NAME, backup_name)
        print(f"✅ Резервная копия создана: {backup_name}")
        return backup_name
    except Exception as e:
        print(f"❌ Ошибка создания резервной копии: {e}")
        return None

async def run_migration():
    """Выполняет полную миграцию v2"""
    
    print("🚀 Начинаем миграцию ФОТ системы в версию 2.0")
    print("=" * 60)
    
    # Создаем резервную копию
    backup_file = await backup_database()
    if not backup_file:
        print("❌ Не удалось создать резервную копию. Миграция отменена.")
        return False
    
    try:
        async with aiosqlite.connect(DB_NAME, timeout=60.0) as db:
            # Включаем WAL режим для безопасности
            await db.execute("PRAGMA journal_mode=WAL")
            await db.execute("PRAGMA foreign_keys=OFF")  # Временно отключаем FK
            
            print("📊 Шаг 1: Создание таблицы work_plans...")
            
            # 1. Создаем таблицу work_plans
            await db.execute('''
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
            ''')
            
            # Индекс для work_plans
            await db.execute('''
                CREATE INDEX IF NOT EXISTS idx_work_plans_role_date 
                ON work_plans(role, year, month)
            ''')
            
            # Триггер для work_plans
            await db.execute('''
                CREATE TRIGGER IF NOT EXISTS update_work_plans_timestamp 
                AFTER UPDATE ON work_plans
                FOR EACH ROW 
                BEGIN
                    UPDATE work_plans 
                    SET updated_at = datetime('now', 'localtime')
                    WHERE id = NEW.id;
                END
            ''')
            
            print("✅ Таблица work_plans создана")
            
            print("💰 Шаг 2: Расширение таблицы rates...")
            
            # 2. Добавляем hourly_rate_tl в rates
            try:
                await db.execute("ALTER TABLE rates ADD COLUMN hourly_rate_tl REAL DEFAULT 0")
                print("✅ Добавлена колонка hourly_rate_tl в rates")
            except Exception as e:
                if "duplicate column name" in str(e).lower():
                    print("✅ Колонка hourly_rate_tl уже существует")
                else:
                    raise e
            
            print("📋 Шаг 3: Создание новой структуры payroll_reports...")
            
            # 3. Пересоздаем payroll_reports
            await db.execute('''
                CREATE TABLE IF NOT EXISTS payroll_reports_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    establishment_id INTEGER NOT NULL,
                    year INTEGER NOT NULL,
                    month INTEGER NOT NULL,
                    revenue REAL,
                    total_hookahs INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'draft',
                    created_by INTEGER,
                    created_at TEXT DEFAULT (datetime('now', 'localtime')),
                    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
                    FOREIGN KEY(created_by) REFERENCES Users(id)
                )
            ''')
            
            # Переносим данные если есть
            cursor = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='payroll_reports'")
            if await cursor.fetchone():
                print("📦 Переносим данные из старой таблицы payroll_reports...")
                await db.execute('''
                    INSERT INTO payroll_reports_new (
                        establishment_id, year, month, revenue, total_hookahs, 
                        status, created_by, created_at, updated_at
                    )
                    SELECT 
                        establishment_id,
                        CAST(strftime('%Y', period_start) AS INTEGER) as year,
                        CAST(strftime('%m', period_start) AS INTEGER) as month,
                        revenue,
                        total_hookahs,
                        status,
                        created_by,
                        created_at,
                        updated_at
                    FROM payroll_reports 
                    WHERE id IN (
                        SELECT MIN(id) FROM payroll_reports 
                        GROUP BY establishment_id, strftime('%Y-%m', period_start)
                    )
                ''')
                
                await db.execute("DROP TABLE payroll_reports")
                print("✅ Старая таблица payroll_reports удалена")
            
            await db.execute("ALTER TABLE payroll_reports_new RENAME TO payroll_reports")
            print("✅ Новая структура payroll_reports создана")
            
            print("👥 Шаг 4: Создание новой структуры payroll_entries...")
            
            # 4. Пересоздаем payroll_entries
            await db.execute('''
                CREATE TABLE payroll_entries_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    payroll_report_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    
                    -- Общая часть
                    monthly_tariff REAL DEFAULT 0,
                    motivation_percent REAL DEFAULT 0,
                    motivation_tl REAL DEFAULT 0,
                    monthly_income REAL DEFAULT 0,
                    planned_hours REAL DEFAULT 0,
                    hourly_rate_tl REAL DEFAULT 0,
                    actual_hours REAL DEFAULT 0,
                    monthly_total REAL DEFAULT 0,
                    
                    -- Аванс (1-15)
                    advance_amount REAL DEFAULT 0,
                    advance_expenses REAL DEFAULT 0,
                    advance_total REAL DEFAULT 0,
                    advance_paid BOOLEAN DEFAULT FALSE,
                    
                    -- Зарплата (16-end)
                    salary_remainder REAL DEFAULT 0,
                    salary_expenses REAL DEFAULT 0,
                    salary_total REAL DEFAULT 0,
                    salary_paid BOOLEAN DEFAULT FALSE,
                    salary_comment TEXT DEFAULT '',
                    
                    created_at TEXT DEFAULT (datetime('now', 'localtime')),
                    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
                    
                    FOREIGN KEY(payroll_report_id) REFERENCES payroll_reports(id) ON DELETE CASCADE,
                    FOREIGN KEY(user_id) REFERENCES Users(id)
                )
            ''')
            
            # Удаляем старую таблицу
            await db.execute("DROP TABLE IF EXISTS payroll_entries")
            await db.execute("ALTER TABLE payroll_entries_new RENAME TO payroll_entries")
            print("✅ Новая структура payroll_entries создана")
            
            print("🔍 Шаг 5: Создание индексов...")
            
            # 5. Создаем индексы
            indexes = [
                "CREATE INDEX IF NOT EXISTS idx_payroll_reports_establishment_date ON payroll_reports(establishment_id, year, month)",
                "CREATE INDEX IF NOT EXISTS idx_payroll_entries_report_v2 ON payroll_entries(payroll_report_id)",
                "CREATE INDEX IF NOT EXISTS idx_payroll_entries_user_v2 ON payroll_entries(user_id)"
            ]
            
            for index_sql in indexes:
                await db.execute(index_sql)
            
            print("✅ Индексы созданы")
            
            print("⚡ Шаг 6: Создание триггеров...")
            
            # 6. Создаем триггеры
            await db.execute('''
                CREATE TRIGGER IF NOT EXISTS update_payroll_reports_timestamp_v2 
                AFTER UPDATE ON payroll_reports
                FOR EACH ROW 
                BEGIN
                    UPDATE payroll_reports 
                    SET updated_at = datetime('now', 'localtime')
                    WHERE id = NEW.id;
                END
            ''')
            
            await db.execute('''
                CREATE TRIGGER IF NOT EXISTS update_payroll_entries_timestamp_v2 
                AFTER UPDATE ON payroll_entries
                FOR EACH ROW 
                BEGIN
                    UPDATE payroll_entries 
                    SET updated_at = datetime('now', 'localtime')
                    WHERE id = NEW.id;
                END
            ''')
            
            print("✅ Триггеры созданы")
            
            print("📅 Шаг 7: Добавление базовых планов работы...")
            
            # 7. Добавляем базовые планы
            current_month = datetime.now().month
            current_year = datetime.now().year
            
            base_plans = [
                ('кальянщик', 260),
                ('старший кальянщик', 280),
                ('администратор', 260),
                ('уборщик', 260),
                ('студент', 260),
                ('бармен/зал', 260)
            ]
            
            for role, hours in base_plans:
                await db.execute('''
                    INSERT OR IGNORE INTO work_plans (role, year, month, planned_hours)
                    VALUES (?, ?, ?, ?)
                ''', (role, current_year, current_month, hours))
            
            print(f"✅ Базовые планы добавлены для {current_month}/{current_year}")
            
            print("💸 Шаг 8: Обновление тарифов с часовыми ставками...")
            
            # 8. Обновляем тарифы с часовыми ставками
            hourly_rates = [
                ('кальянщик', 80),
                ('старший кальянщик', 90),
                ('администратор', 120),
                ('уборщик', 70),
                ('студент', 60),
                ('бармен/зал', 75)
            ]
            
            for role, rate in hourly_rates:
                await db.execute('''
                    UPDATE rates SET hourly_rate_tl = ? 
                    WHERE role = ? AND hourly_rate_tl = 0
                ''', (rate, role))
            
            print("✅ Часовые ставки обновлены")
            
            print("🧹 Шаг 9: Очистка устаревших данных...")
            
            # 9. Очищаем аудит старых записей
            await db.execute('''
                DELETE FROM payroll_audit_log 
                WHERE payroll_entry_id NOT IN (SELECT id FROM payroll_entries)
            ''')
            
            print("✅ Устаревшие данные очищены")
            
            # Включаем обратно FK и анализируем
            await db.execute("PRAGMA foreign_keys=ON")
            await db.execute("ANALYZE")
            
            await db.commit()
            
            print("🔍 Шаг 10: Проверка целостности...")
            
            # Проверяем целостность
            cursor = await db.execute("PRAGMA integrity_check")
            integrity_result = await cursor.fetchone()
            
            if integrity_result[0] == "ok":
                print("✅ Проверка целостности пройдена")
            else:
                print(f"⚠️ Проблемы с целостностью: {integrity_result[0]}")
            
            # Показываем статистику
            stats_queries = [
                ("Work plans", "SELECT COUNT(*) FROM work_plans"),
                ("Payroll reports", "SELECT COUNT(*) FROM payroll_reports"),
                ("Payroll entries", "SELECT COUNT(*) FROM payroll_entries"),
                ("Rates with hourly_rate_tl", "SELECT COUNT(*) FROM rates WHERE hourly_rate_tl > 0")
            ]
            
            print("\n📊 Статистика после миграции:")
            for name, query in stats_queries:
                cursor = await db.execute(query)
                count = (await cursor.fetchone())[0]
                print(f"  {name}: {count}")
            
            print("\n" + "=" * 60)
            print("🎉 Миграция ФОТ v2.0 завершена успешно!")
            print("🔧 Теперь можно обновлять бэкенд и фронтенд")
            print(f"💾 Резервная копия: {backup_file}")
            
            return True
            
    except Exception as e:
        print(f"\n❌ Ошибка миграции: {e}")
        print(f"💾 Восстановите базу из резервной копии: {backup_file}")
        return False

async def check_migration_status():
    """Проверяет статус миграции"""
    try:
        async with aiosqlite.connect(DB_NAME) as db:
            # Проверяем наличие новых таблиц и полей
            cursor = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='work_plans'")
            has_work_plans = await cursor.fetchone() is not None
            
            cursor = await db.execute("PRAGMA table_info(payroll_entries)")
            columns = [row[1] for row in await cursor.fetchall()]
            has_new_structure = 'monthly_tariff' in columns
            
            cursor = await db.execute("PRAGMA table_info(rates)")
            rate_columns = [row[1] for row in await cursor.fetchall()]
            has_hourly_rate = 'hourly_rate_tl' in rate_columns
            
            print("📋 Статус миграции ФОТ v2.0:")
            print(f"  Work plans таблица: {'✅' if has_work_plans else '❌'}")
            print(f"  Новая структура payroll_entries: {'✅' if has_new_structure else '❌'}")
            print(f"  Часовые ставки в rates: {'✅' if has_hourly_rate else '❌'}")
            
            if has_work_plans and has_new_structure and has_hourly_rate:
                print("🎉 Миграция v2.0 уже выполнена!")
                return True
            else:
                print("⚠️ Миграция v2.0 не завершена")
                return False
                
    except Exception as e:
        print(f"❌ Ошибка проверки: {e}")
        return False

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--check":
        asyncio.run(check_migration_status())
    else:
        print("🚨 ВНИМАНИЕ: Это необратимая миграция ФОТ системы!")
        print("📋 Будут изменены:")
        print("  - Структура payroll_reports (period -> year/month)")
        print("  - Структура payroll_entries (полностью новая)")
        print("  - Добавлена таблица work_plans")
        print("  - Расширена таблица rates")
        print()
        
        confirm = input("Продолжить миграцию? (yes/NO): ").lower().strip()
        if confirm == 'yes':
            success = asyncio.run(run_migration())
            sys.exit(0 if success else 1)
        else:
            print("❌ Миграция отменена")
            sys.exit(1)