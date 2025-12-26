import asyncio
import aiosqlite
from datetime import datetime

DB_NAME = "../shift_manager.db"

async def check_and_create_base_tables():
    """Проверяет и создает базовые таблицы если их нет"""
    
    async with aiosqlite.connect(DB_NAME) as db:
        print("🔍 Проверяем существование базовых таблиц...")
        
        # Получаем список существующих таблиц
        cursor = await db.execute("SELECT name FROM sqlite_master WHERE type='table'")
        existing_tables = [row[0] for row in await cursor.fetchall()]
        print(f"📋 Найденные таблицы: {existing_tables}")
        
        # Создаем базовые таблицы если их нет
        if 'Users' not in existing_tables:
            print("➕ Создаем таблицу Users...")
            await db.execute('''
            CREATE TABLE Users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                telegram_id INTEGER UNIQUE,
                name TEXT,
                status TEXT
            )
            ''')
        else:
            print("✅ Таблица Users уже существует")
            
        if 'Shifts' not in existing_tables:
            print("➕ Создаем таблицу Shifts...")
            await db.execute('''
            CREATE TABLE Shifts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                start_time TEXT,
                end_time TEXT,
                location TEXT,
                duration_hours REAL,
                shift_date TEXT,
                FOREIGN KEY(user_id) REFERENCES Users(id)
            )
            ''')
        else:
            print("✅ Таблица Shifts уже существует")
            
        if 'Reports' not in existing_tables:
            print("➕ Создаем таблицу Reports...")
            await db.execute('''
            CREATE TABLE Reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                shift_id INTEGER,
                report_text TEXT,
                created_at TEXT,
                FOREIGN KEY(shift_id) REFERENCES Shifts(id)
            )
            ''')
        else:
            print("✅ Таблица Reports уже существует")
            
        await db.commit()
        print("✅ Базовые таблицы готовы!")

async def add_role_column_to_users():
    """Добавляет колонку role в таблицу Users"""
    
    async with aiosqlite.connect(DB_NAME) as db:
        print("🔍 Проверяем колонку role в таблице Users...")
        
        # Проверяем существующие колонки в таблице Users
        cursor = await db.execute("PRAGMA table_info(Users)")
        existing_columns = [row[1] for row in await cursor.fetchall()]
        print(f"📋 Существующие колонки в Users: {existing_columns}")
        
        # Добавляем роль в таблицу Users (БЕЗ удаления данных)
        if 'role' not in existing_columns:
            print("➕ Добавляем колонку role в Users...")
            await db.execute("ALTER TABLE Users ADD COLUMN role TEXT DEFAULT NULL")
            await db.commit()
        else:
            print("✅ Колонка role уже существует в Users")

async def create_payroll_tables():
    """Создает таблицы для системы ФОТ"""
    
    async with aiosqlite.connect(DB_NAME) as db:
        print("🔍 Проверяем таблицы системы ФОТ...")
        
        # Получаем список существующих таблиц
        cursor = await db.execute("SELECT name FROM sqlite_master WHERE type='table'")
        existing_tables = [row[0] for row in await cursor.fetchall()]
        
        # Создаем таблицу тарифов
        if 'rates' not in existing_tables:
            print("📊 Создаем таблицу rates...")
            await db.execute('''
            CREATE TABLE rates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                role TEXT NOT NULL,
                rate REAL NOT NULL,
                period_type TEXT NOT NULL,
                effective_date TEXT NOT NULL,
                created_at TEXT DEFAULT (datetime('now', 'localtime')),
                updated_at TEXT DEFAULT (datetime('now', 'localtime'))
            )
            ''')
        else:
            print("✅ Таблица rates уже существует")
        
        # Создаем таблицу отчетов ФОТ
        if 'payroll_reports' not in existing_tables:
            print("📊 Создаем таблицу payroll_reports...")
            await db.execute('''
            CREATE TABLE payroll_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                establishment_id INTEGER NOT NULL,
                period_start TEXT NOT NULL,
                period_end TEXT NOT NULL,
                revenue REAL,
                total_hookahs INTEGER DEFAULT 0,
                status TEXT DEFAULT 'draft',
                created_by INTEGER,
                created_at TEXT DEFAULT (datetime('now', 'localtime')),
                updated_at TEXT DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY(created_by) REFERENCES Users(id)
            )
            ''')
        else:
            print("✅ Таблица payroll_reports уже существует")
        
        # Создаем таблицу записей по сотрудникам
        if 'payroll_entries' not in existing_tables:
            print("📊 Создаем таблицу payroll_entries...")
            await db.execute('''
            CREATE TABLE payroll_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                payroll_report_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                hours_worked REAL DEFAULT 0,
                hookahs_sold INTEGER DEFAULT 0,
                base_salary REAL DEFAULT 0,
                motivation_percent REAL DEFAULT 0,
                motivation_amount REAL DEFAULT 0,
                prepaid_expense REAL DEFAULT 0,
                card_payment REAL DEFAULT 0,
                housing_deduction REAL DEFAULT 0,
                final_payment REAL DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now', 'localtime')),
                updated_at TEXT DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY(payroll_report_id) REFERENCES payroll_reports(id) ON DELETE CASCADE,
                FOREIGN KEY(user_id) REFERENCES Users(id)
            )
            ''')
        else:
            print("✅ Таблица payroll_entries уже существует")
        
        # Создаем таблицу аудита ФОТ
        if 'payroll_audit_log' not in existing_tables:
            print("📊 Создаем таблицу payroll_audit_log...")
            await db.execute('''
            CREATE TABLE payroll_audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                payroll_entry_id INTEGER NOT NULL,
                field_name TEXT NOT NULL,
                old_value TEXT,
                new_value TEXT,
                changed_by INTEGER NOT NULL,
                changed_at TEXT DEFAULT (datetime('now', 'localtime')),
                change_reason TEXT,
                FOREIGN KEY(payroll_entry_id) REFERENCES payroll_entries(id) ON DELETE CASCADE,
                FOREIGN KEY(changed_by) REFERENCES Users(id)
            )
            ''')
        else:
            print("✅ Таблица payroll_audit_log уже существует")
            
        await db.commit()
        print("✅ Таблицы системы ФОТ готовы!")

async def create_indexes():
    """Создает индексы для производительности"""
    
    async with aiosqlite.connect(DB_NAME) as db:
        print("🔍 Создаем индексы...")
        
        indexes_to_create = [
            ("idx_payroll_reports_establishment", "payroll_reports", "establishment_id"),
            ("idx_payroll_reports_period", "payroll_reports", "period_start, period_end"),
            ("idx_payroll_entries_report", "payroll_entries", "payroll_report_id"),
            ("idx_payroll_entries_user", "payroll_entries", "user_id"),
            ("idx_payroll_audit_entry", "payroll_audit_log", "payroll_entry_id"),
            ("idx_rates_role_date", "rates", "role, effective_date"),
        ]
        
        for index_name, table_name, columns in indexes_to_create:
            try:
                await db.execute(f'''
                CREATE INDEX IF NOT EXISTS {index_name} 
                ON {table_name}({columns})
                ''')
                print(f"✅ Индекс {index_name} создан")
            except Exception as e:
                print(f"⚠️ Ошибка создания индекса {index_name}: {e}")
        
        await db.commit()

async def create_triggers():
    """Создает триггеры для автоматического обновления updated_at"""
    
    async with aiosqlite.connect(DB_NAME) as db:
        print("⚡ Создаем триггеры для updated_at...")
        
        triggers = [
            ("update_payroll_reports_timestamp", "payroll_reports"),
            ("update_payroll_entries_timestamp", "payroll_entries"),
            ("update_rates_timestamp", "rates"),
        ]
        
        for trigger_name, table_name in triggers:
            try:
                await db.execute(f'''
                CREATE TRIGGER IF NOT EXISTS {trigger_name} 
                AFTER UPDATE ON {table_name}
                FOR EACH ROW 
                BEGIN
                    UPDATE {table_name} 
                    SET updated_at = datetime('now', 'localtime')
                    WHERE id = NEW.id;
                END
                ''')
                print(f"✅ Триггер {trigger_name} создан")
            except Exception as e:
                print(f"⚠️ Ошибка создания триггера {trigger_name}: {e}")
        
        await db.commit()

async def add_base_rates():
    """Добавляет базовые тарифы"""
    
    async with aiosqlite.connect(DB_NAME) as db:
        print("💰 Проверяем базовые тарифы...")
        
        # Проверяем, есть ли уже тарифы
        cursor = await db.execute("SELECT COUNT(*) FROM rates")
        existing_rates_count = (await cursor.fetchone())[0]
        
        if existing_rates_count > 0:
            print(f"✅ Найдено {existing_rates_count} существующих тарифов, пропускаем создание базовых")
            return
        
        print("➕ Добавляем базовые тарифы...")
        current_date = datetime.now().isoformat()
        
        base_rates = [
            # Кальянщик
            ('кальянщик', 10, 'per_hookah', current_date),
            # Старший кальянщик  
            ('старший кальянщик', 10, 'per_hookah', current_date),
            # Уборщик
            ('уборщик', 15000, '1-15', current_date),
            ('уборщик', 19000, '16-end', current_date),
            # Бармен/зал
            ('бармен/зал', 15000, '1-15', current_date),
            ('бармен/зал', 21000, '16-end', current_date),
            # Студент
            ('студент', 15000, '1-15', current_date),
            ('студент', 20000, '16-end', current_date),
            # Администратор
            ('администратор', 20000, '1-15', current_date),
            ('администратор', 26000, '16-end', current_date),
        ]
        
        for role, rate, period_type, effective_date in base_rates:
            await db.execute('''
                INSERT INTO rates (role, rate, period_type, effective_date)
                VALUES (?, ?, ?, ?)
            ''', (role, rate, period_type, effective_date))
            print(f"✅ Тариф добавлен: {role} - {rate} ({period_type})")
        
        await db.commit()

async def verify_migration():
    """Проверяет результаты миграции"""
    
    async with aiosqlite.connect(DB_NAME) as db:
        print("\n🔍 Проверяем результаты миграции...")
        
        # Проверяем все таблицы
        cursor = await db.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in await cursor.fetchall()]
        print(f"📊 Таблицы в БД: {tables}")
        
        # Проверяем структуру Users
        cursor = await db.execute("PRAGMA table_info(Users)")
        users_columns = [row[1] for row in await cursor.fetchall()]
        print(f"👥 Колонки в Users: {users_columns}")
        
        # Проверяем количество записей
        tables_to_check = ['rates', 'payroll_reports', 'payroll_entries', 'payroll_audit_log']
        for table in tables_to_check:
            if table in tables:
                cursor = await db.execute(f"SELECT COUNT(*) FROM {table}")
                count = (await cursor.fetchone())[0]
                print(f"📋 Записей в {table}: {count}")
        
        # Проверяем индексы
        cursor = await db.execute("SELECT name FROM sqlite_master WHERE type='index'")
        indexes = [row[0] for row in await cursor.fetchall()]
        payroll_indexes = [idx for idx in indexes if any(x in idx for x in ['payroll', 'rates'])]
        print(f"🔍 Индексы ФОТ: {payroll_indexes}")
        
        # Проверяем триггеры
        cursor = await db.execute("SELECT name FROM sqlite_master WHERE type='trigger'")
        triggers = [row[0] for row in await cursor.fetchall()]
        payroll_triggers = [trg for trg in triggers if any(x in trg for x in ['payroll', 'rates'])]
        print(f"⚡ Триггеры ФОТ: {payroll_triggers}")
        
        print("✅ Проверка завершена!")

async def migrate_complete():
    """Полная миграция системы ФОТ"""
    
    try:
        print("🔧 Начинаем полную миграцию системы ФОТ...")
        
        # Шаг 1: Создаем базовые таблицы
        await check_and_create_base_tables()
        
        # Шаг 2: Добавляем роль в Users
        await add_role_column_to_users()
        
        # Шаг 3: Создаем таблицы ФОТ
        await create_payroll_tables()
        
        # Шаг 4: Создаем индексы
        await create_indexes()
        
        # Шаг 5: Создаем триггеры
        await create_triggers()
        
        # Шаг 6: Добавляем базовые тарифы
        await add_base_rates()
        
        # Шаг 7: Проверяем результат
        await verify_migration()
        
        print("✅ Миграция завершена успешно!")
        
    except Exception as e:
        print(f"❌ Ошибка миграции: {e}")
        raise e

async def rollback_payroll():
    """Откатывает миграцию ФОТ (ОСТОРОЖНО!)"""
    
    async with aiosqlite.connect(DB_NAME) as db:
        try:
            print("⚠️  ВНИМАНИЕ: Откат миграции ФОТ...")
            confirm = input("Вы уверены? Это удалит ВСЕ данные ФОТ! (yes/NO): ").lower().strip()
            
            if confirm != 'yes':
                print("❌ Откат отменен")
                return
                
            print("🗑️  Удаляем компоненты ФОТ...")
            
            # Удаляем триггеры
            await db.execute("DROP TRIGGER IF EXISTS update_payroll_reports_timestamp")
            await db.execute("DROP TRIGGER IF EXISTS update_payroll_entries_timestamp") 
            await db.execute("DROP TRIGGER IF EXISTS update_rates_timestamp")
            
            # Удаляем индексы
            await db.execute("DROP INDEX IF EXISTS idx_payroll_reports_establishment")
            await db.execute("DROP INDEX IF EXISTS idx_payroll_reports_period")
            await db.execute("DROP INDEX IF EXISTS idx_payroll_entries_report")
            await db.execute("DROP INDEX IF EXISTS idx_payroll_entries_user")
            await db.execute("DROP INDEX IF EXISTS idx_payroll_audit_entry")
            await db.execute("DROP INDEX IF EXISTS idx_rates_role_date")
            
            # Удаляем таблицы ФОТ
            await db.execute("DROP TABLE IF EXISTS payroll_audit_log")
            await db.execute("DROP TABLE IF EXISTS payroll_entries")
            await db.execute("DROP TABLE IF EXISTS payroll_reports")
            await db.execute("DROP TABLE IF EXISTS rates")
            
            # НЕ удаляем колонку role из Users, так как это может сломать существующие данные
            print("⚠️  Колонка 'role' в таблице Users НЕ удалена для безопасности")
            
            await db.commit()
            print("✅ Откат завершен")
            
        except Exception as e:
            print(f"❌ Ошибка отката: {e}")
            raise e

if __name__ == "__main__":
    import sys
    
    print("🚀 Полная миграция системы ФОТ")
    print("=" * 50)
    
    if len(sys.argv) > 1 and sys.argv[1] == "--rollback":
        asyncio.run(rollback_payroll())
    else:
        asyncio.run(migrate_complete())
    
    print("\n" + "=" * 50)
    print("🎉 Готово! Теперь можно:")
    print("1️⃣  Добавить API endpoints в main.py")
    print("2️⃣  Создать React компоненты")
    print("3️⃣  Перезапустить сервер")
    print("4️⃣  Назначить роли пользователям")
    print("5️⃣  Создать первый отчет ФОТ")