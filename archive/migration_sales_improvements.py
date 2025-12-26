#!/usr/bin/env python3
"""
Миграция для добавления функций продаж и улучшения тарифов
"""

import asyncio
import aiosqlite
import sys
from datetime import datetime

DB_NAME = "../shift_manager.db"

async def backup_database():
    """Создает резервную копию базы данных"""
    import shutil
    
    backup_name = f"../shift_manager_backup_sales_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
    try:
        shutil.copy2(DB_NAME, backup_name)
        print(f"✅ Резервная копия создана: {backup_name}")
        return backup_name
    except Exception as e:
        print(f"❌ Ошибка создания резервной копии: {e}")
        return None

async def add_sales_fields_to_payroll_entries():
    """Добавляет поля продаж в payroll_entries"""
    print("📊 Добавляем поля продаж в payroll_entries...")
    
    async with aiosqlite.connect(DB_NAME) as db:
        # Проверяем существующие колонки
        cursor = await db.execute("PRAGMA table_info(payroll_entries)")
        existing_columns = [row[1] for row in await cursor.fetchall()]
        
        # Добавляем новые поля для продаж
        new_fields = [
            ('sales_1_15', 'INTEGER DEFAULT 0'),      # Продажи 1-15
            ('sales_16_31', 'INTEGER DEFAULT 0'),     # Продажи 16-31
            ('total_sales', 'INTEGER DEFAULT 0'),     # Общие продажи (автосумма)
            ('advance_amount_calc', 'REAL DEFAULT 0'), # Рассчитанная сумма аванса
            ('salary_amount_calc', 'REAL DEFAULT 0'),  # Рассчитанная сумма зарплаты
        ]
        
        for field_name, field_type in new_fields:
            if field_name not in existing_columns:
                print(f"➕ Добавляем поле {field_name}...")
                await db.execute(f"ALTER TABLE payroll_entries ADD COLUMN {field_name} {field_type}")
        
        await db.commit()
        print("✅ Поля продаж добавлены в payroll_entries")

async def add_monthly_total_to_rates():
    """Добавляет поле месячного итога в rates"""
    print("💰 Добавляем поле месячного итога в rates...")
    
    async with aiosqlite.connect(DB_NAME) as db:
        # Проверяем существующие колонки
        cursor = await db.execute("PRAGMA table_info(rates)")
        existing_columns = [row[1] for row in await cursor.fetchall()]
        
        if 'monthly_total' not in existing_columns:
            print("➕ Добавляем поле monthly_total...")
            await db.execute("ALTER TABLE rates ADD COLUMN monthly_total REAL DEFAULT 0")
        
        await db.commit()
        print("✅ Поле monthly_total добавлено в rates")

async def add_sales_plans_to_work_plans():
    """Добавляет планы продаж в work_plans"""
    print("🎯 Добавляем планы продаж в work_plans...")
    
    async with aiosqlite.connect(DB_NAME) as db:
        # Проверяем существующие колонки
        cursor = await db.execute("PRAGMA table_info(work_plans)")
        existing_columns = [row[1] for row in await cursor.fetchall()]
        
        if 'planned_sales' not in existing_columns:
            print("➕ Добавляем поле planned_sales...")
            await db.execute("ALTER TABLE work_plans ADD COLUMN planned_sales INTEGER DEFAULT 0")
        
        await db.commit()
        print("✅ Поле planned_sales добавлено в work_plans")

async def add_total_sales_to_payroll_reports():
    """Добавляет общие продажи в payroll_reports"""
    print("📈 Добавляем общие продажи в payroll_reports...")
    
    async with aiosqlite.connect(DB_NAME) as db:
        # Проверяем существующие колонки
        cursor = await db.execute("PRAGMA table_info(payroll_reports)")
        existing_columns = [row[1] for row in await cursor.fetchall()]
        
        if 'total_sales' not in existing_columns:
            print("➕ Добавляем поле total_sales...")
            await db.execute("ALTER TABLE payroll_reports ADD COLUMN total_sales INTEGER DEFAULT 0")
        
        await db.commit()
        print("✅ Поле total_sales добавлено в payroll_reports")

async def calculate_existing_monthly_totals():
    """Рассчитывает месячные итоги для существующих тарифов"""
    print("🧮 Рассчитываем месячные итоги для существующих тарифов...")
    
    async with aiosqlite.connect(DB_NAME) as db:
        # Получаем все роли
        cursor = await db.execute("SELECT DISTINCT role FROM rates")
        roles = [row[0] for row in await cursor.fetchall()]
        
        for role in roles:
            # Получаем тарифы 1-15 и 16-end для каждой роли
            cursor = await db.execute('''
                SELECT period_type, rate, effective_date 
                FROM rates 
                WHERE role = ? AND period_type IN ('1-15', '16-end')
                ORDER BY effective_date DESC
            ''', (role,))
            
            rate_data = await cursor.fetchall()
            
            # Группируем по дате вступления в силу
            rates_by_date = {}
            for period_type, rate, effective_date in rate_data:
                if effective_date not in rates_by_date:
                    rates_by_date[effective_date] = {}
                rates_by_date[effective_date][period_type] = rate
            
            # Рассчитываем месячные итоги
            for effective_date, rates in rates_by_date.items():
                if '1-15' in rates and '16-end' in rates:
                    monthly_total = rates['1-15'] + rates['16-end']
                    
                    # Обновляем все записи с этой датой
                    await db.execute('''
                        UPDATE rates 
                        SET monthly_total = ? 
                        WHERE role = ? AND effective_date = ?
                    ''', (monthly_total, role, effective_date))
                    
                    print(f"✅ {role} от {effective_date}: {monthly_total}")
        
        await db.commit()
        print("✅ Месячные итоги рассчитаны")

async def add_default_sales_plans():
    """Добавляет планы продаж по умолчанию"""
    print("🎯 Добавляем планы продаж по умолчанию...")
    
    async with aiosqlite.connect(DB_NAME) as db:
        # Планы продаж для кальянщиков
        current_year = datetime.now().year
        current_month = datetime.now().month
        
        # Планы по заведениям (будем использовать роль как индикатор заведения)
        sales_plans = [
            ('кальянщик', 'Göktürk', 2500),      # Göktürk
            ('кальянщик', 'Yenibosna', 3500),    # Yenibosna
            ('старший кальянщик', 'Göktürk', 2500),
            ('старший кальянщик', 'Yenibosna', 3500),
        ]
        
        # Для каждого заведения создаем планы
        for role, location, planned_sales in sales_plans:
            # Проверяем существует ли уже план
            cursor = await db.execute('''
                SELECT id FROM work_plans 
                WHERE role = ? AND year = ? AND month = ?
            ''', (f"{role}_{location}", current_year, current_month))
            
            existing = await cursor.fetchone()
            
            if not existing:
                # Создаем новый план
                await db.execute('''
                    INSERT INTO work_plans (role, year, month, planned_hours, planned_sales)
                    VALUES (?, ?, ?, ?, ?)
                ''', (f"{role}_{location}", current_year, current_month, 160, planned_sales))
                
                print(f"✅ План продаж {role} {location}: {planned_sales}")
            else:
                # Обновляем существующий план
                await db.execute('''
                    UPDATE work_plans 
                    SET planned_sales = ? 
                    WHERE role = ? AND year = ? AND month = ?
                ''', (planned_sales, f"{role}_{location}", current_year, current_month))
                
                print(f"🔄 Обновлен план продаж {role} {location}: {planned_sales}")
        
        await db.commit()
        print("✅ Планы продаж добавлены")

async def create_monthly_totals_trigger():
    """Создает триггер для автоматического обновления месячных итогов"""
    print("⚡ Создаем триггер для автоматического обновления месячных итогов...")
    
    async with aiosqlite.connect(DB_NAME) as db:
        # Триггер при вставке нового тарифа
        await db.execute('''
            CREATE TRIGGER IF NOT EXISTS calculate_monthly_total_insert
            AFTER INSERT ON rates
            FOR EACH ROW
            WHEN NEW.period_type IN ('1-15', '16-end')
            BEGIN
                UPDATE rates SET monthly_total = (
                    SELECT COALESCE(SUM(rate), 0)
                    FROM rates r2 
                    WHERE r2.role = NEW.role 
                    AND r2.effective_date = NEW.effective_date
                    AND r2.period_type IN ('1-15', '16-end')
                )
                WHERE role = NEW.role AND effective_date = NEW.effective_date;
            END
        ''')
        
        # Триггер при обновлении тарифа
        await db.execute('''
            CREATE TRIGGER IF NOT EXISTS calculate_monthly_total_update
            AFTER UPDATE ON rates
            FOR EACH ROW
            WHEN NEW.period_type IN ('1-15', '16-end')
            BEGIN
                UPDATE rates SET monthly_total = (
                    SELECT COALESCE(SUM(rate), 0)
                    FROM rates r2 
                    WHERE r2.role = NEW.role 
                    AND r2.effective_date = NEW.effective_date
                    AND r2.period_type IN ('1-15', '16-end')
                )
                WHERE role = NEW.role AND effective_date = NEW.effective_date;
            END
        ''')
        
        await db.commit()
        print("✅ Триггеры для месячных итогов созданы")

async def run_migration():
    """Выполняет полную миграцию"""
    print("🚀 Начинаем миграцию для улучшений продаж и тарифов")
    print("=" * 60)
    
    # Создаем резервную копию
    backup_file = await backup_database()
    if not backup_file:
        print("❌ Не удалось создать резервную копию. Миграция отменена.")
        return False
    
    try:
        # Шаг 1: Добавляем поля продаж в payroll_entries
        await add_sales_fields_to_payroll_entries()
        
        # Шаг 2: Добавляем месячный итог в rates
        await add_monthly_total_to_rates()
        
        # Шаг 3: Добавляем планы продаж в work_plans
        await add_sales_plans_to_work_plans()
        
        # Шаг 4: Добавляем общие продажи в payroll_reports
        await add_total_sales_to_payroll_reports()
        
        # Шаг 5: Рассчитываем существующие месячные итоги
        await calculate_existing_monthly_totals()
        
        # Шаг 6: Добавляем планы продаж по умолчанию
        await add_default_sales_plans()
        
        # Шаг 7: Создаем триггеры
        await create_monthly_totals_trigger()
        
        print("\n" + "=" * 60)
        print("🎉 Миграция завершена успешно!")
        print("🔧 Теперь можно обновлять backend и frontend")
        print(f"💾 Резервная копия: {backup_file}")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Ошибка миграции: {e}")
        print(f"💾 Восстановите базу из резервной копии: {backup_file}")
        return False

async def verify_migration():
    """Проверяет результаты миграции"""
    print("\n🔍 Проверяем результаты миграции...")
    
    async with aiosqlite.connect(DB_NAME) as db:
        # Проверяем payroll_entries
        cursor = await db.execute("PRAGMA table_info(payroll_entries)")
        pe_columns = [row[1] for row in await cursor.fetchall()]
        
        sales_fields = ['sales_1_15', 'sales_16_31', 'total_sales', 'advance_amount_calc', 'salary_amount_calc']
        pe_status = all(field in pe_columns for field in sales_fields)
        print(f"📊 Поля продаж в payroll_entries: {'✅' if pe_status else '❌'}")
        
        # Проверяем rates
        cursor = await db.execute("PRAGMA table_info(rates)")
        rates_columns = [row[1] for row in await cursor.fetchall()]
        rates_status = 'monthly_total' in rates_columns
        print(f"💰 Месячный итог в rates: {'✅' if rates_status else '❌'}")
        
        # Проверяем work_plans
        cursor = await db.execute("PRAGMA table_info(work_plans)")
        wp_columns = [row[1] for row in await cursor.fetchall()]
        wp_status = 'planned_sales' in wp_columns
        print(f"🎯 Планы продаж в work_plans: {'✅' if wp_status else '❌'}")
        
        # Проверяем payroll_reports
        cursor = await db.execute("PRAGMA table_info(payroll_reports)")
        pr_columns = [row[1] for row in await cursor.fetchall()]
        pr_status = 'total_sales' in pr_columns
        print(f"📈 Общие продажи в payroll_reports: {'✅' if pr_status else '❌'}")
        
        # Проверяем триггеры
        cursor = await db.execute("SELECT name FROM sqlite_master WHERE type='trigger' AND name LIKE '%monthly_total%'")
        triggers = await cursor.fetchall()
        trigger_status = len(triggers) >= 2
        print(f"⚡ Триггеры месячных итогов: {'✅' if trigger_status else '❌'}")
        
        # Проверяем данные
        cursor = await db.execute("SELECT COUNT(*) FROM rates WHERE monthly_total > 0")
        monthly_totals_count = (await cursor.fetchone())[0]
        print(f"🧮 Рассчитанных месячных итогов: {monthly_totals_count}")
        
        cursor = await db.execute("SELECT COUNT(*) FROM work_plans WHERE planned_sales > 0")
        sales_plans_count = (await cursor.fetchone())[0]
        print(f"🎯 Планов продаж: {sales_plans_count}")
        
        overall_status = pe_status and rates_status and wp_status and pr_status and trigger_status
        print(f"\n📋 Общий статус миграции: {'✅ УСПЕШНО' if overall_status else '❌ ЕСТЬ ПРОБЛЕМЫ'}")
        
        return overall_status

if __name__ == "__main__":
    print("🚀 Миграция улучшений продаж и тарифов")
    print("=" * 50)
    
    if len(sys.argv) > 1 and sys.argv[1] == "--verify":
        asyncio.run(verify_migration())
    else:
        success = asyncio.run(run_migration())
        if success:
            asyncio.run(verify_migration())
        sys.exit(0 if success else 1)