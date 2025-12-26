import asyncio
import aiosqlite
from datetime import datetime

DB_NAME = "../shift_manager.db"

async def migrate_reports_audit():
    """Добавляет таблицы и поля для аудита отчетов"""
    
    async with aiosqlite.connect(DB_NAME) as db:
        try:
            print("🔧 Начинаем миграцию для аудита отчетов...")
            
            # Проверяем существующие колонки в таблице Reports
            cursor = await db.execute("PRAGMA table_info(Reports)")
            existing_columns = [row[1] for row in await cursor.fetchall()]
            print(f"📋 Существующие колонки в Reports: {existing_columns}")
            
            # Добавляем новые колонки в таблицу Reports
            if 'updated_at' not in existing_columns:
                print("➕ Добавляем колонку updated_at...")
                await db.execute("ALTER TABLE Reports ADD COLUMN updated_at TEXT")
            
            if 'updated_by' not in existing_columns:
                print("➕ Добавляем колонку updated_by...")
                await db.execute("ALTER TABLE Reports ADD COLUMN updated_by INTEGER")
            
            if 'version' not in existing_columns:
                print("➕ Добавляем колонку version...")
                await db.execute("ALTER TABLE Reports ADD COLUMN version INTEGER DEFAULT 1")
            
            # Создаем таблицу аудита
            print("📊 Создаем таблицу ReportsAuditLog...")
            await db.execute('''
            CREATE TABLE IF NOT EXISTS ReportsAuditLog (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                report_id INTEGER NOT NULL,
                version INTEGER NOT NULL,
                action_type TEXT NOT NULL,
                old_text TEXT,
                new_text TEXT,
                changes_summary TEXT,
                changed_fields TEXT,
                change_reason TEXT,
                created_at TEXT NOT NULL,
                created_by INTEGER NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                
                FOREIGN KEY(report_id) REFERENCES Reports(id) ON DELETE CASCADE,
                FOREIGN KEY(created_by) REFERENCES Users(id)
            )
            ''')
            
            # Создаем таблицу сессий редактирования
            print("🔄 Создаем таблицу ReportsEditSessions...")
            await db.execute('''
            CREATE TABLE IF NOT EXISTS ReportsEditSessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                report_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                session_token TEXT NOT NULL,
                started_at TEXT NOT NULL,
                last_activity TEXT NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                
                FOREIGN KEY(report_id) REFERENCES Reports(id) ON DELETE CASCADE,
                FOREIGN KEY(user_id) REFERENCES Users(id),
                
                UNIQUE(report_id, user_id)
            )
            ''')
            
            # Создаем индексы
            print("🔍 Создаем индексы...")
            await db.execute('''
            CREATE INDEX IF NOT EXISTS idx_reports_audit_report_id 
            ON ReportsAuditLog(report_id)
            ''')
            
            await db.execute('''
            CREATE INDEX IF NOT EXISTS idx_reports_audit_created_at 
            ON ReportsAuditLog(created_at)
            ''')
            
            await db.execute('''
            CREATE INDEX IF NOT EXISTS idx_reports_audit_created_by 
            ON ReportsAuditLog(created_by)
            ''')
            
            # Создаем триггер для автоматического обновления updated_at
            print("⚡ Создаем триггер для updated_at...")
            await db.execute('''
            CREATE TRIGGER IF NOT EXISTS update_reports_timestamp 
            AFTER UPDATE ON Reports
            FOR EACH ROW 
            BEGIN
                UPDATE Reports 
                SET updated_at = datetime('now', 'localtime')
                WHERE id = NEW.id;
            END
            ''')
            
            # Инициализируем версии для существующих отчетов
            print("🔢 Инициализируем версии существующих отчетов...")
            await db.execute('''
                UPDATE Reports 
                SET version = 1, updated_at = datetime('now', 'localtime')
                WHERE version IS NULL
            ''')
            
            await db.commit()
            print("✅ Миграция завершена успешно!")
            
            # Показываем статистику
            cursor = await db.execute("SELECT COUNT(*) FROM Reports")
            reports_count = (await cursor.fetchone())[0]
            
            cursor = await db.execute("SELECT COUNT(*) FROM ReportsAuditLog")
            audit_count = (await cursor.fetchone())[0]
            
            print(f"📊 Статистика после миграции:")
            print(f"   - Отчетов в системе: {reports_count}")
            print(f"   - Записей в аудит-логе: {audit_count}")
            
            # Создаем тестовую запись аудита (опционально)
            test_audit = input("\n🧪 Создать тестовую запись аудита? (y/N): ").lower().strip()
            if test_audit == 'y':
                await db.execute('''
                    INSERT INTO ReportsAuditLog 
                    (report_id, version, action_type, old_text, new_text, changes_summary,
                     change_reason, created_at, created_by)
                    VALUES (1, 1, 'system_migration', NULL, 'Test audit entry', 
                            'Тестовая запись после миграции', 'Системная миграция', ?, 1)
                ''', (datetime.now().isoformat(),))
                await db.commit()
                print("✅ Тестовая запись создана!")
            
        except Exception as e:
            print(f"❌ Ошибка миграции: {e}")
            raise

async def verify_migration():
    """Проверяет результаты миграции"""
    async with aiosqlite.connect(DB_NAME) as db:
        print("\n🔍 Проверяем результаты миграции...")
        
        # Проверяем структуру таблицы Reports
        cursor = await db.execute("PRAGMA table_info(Reports)")
        reports_columns = [row[1] for row in await cursor.fetchall()]
        print(f"📋 Колонки в Reports: {reports_columns}")
        
        # Проверяем существование новых таблиц
        cursor = await db.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in await cursor.fetchall()]
        print(f"📊 Таблицы в БД: {tables}")
        
        # Проверяем индексы
        cursor = await db.execute("SELECT name FROM sqlite_master WHERE type='index'")
        indexes = [row[0] for row in await cursor.fetchall()]
        audit_indexes = [idx for idx in indexes if 'reports_audit' in idx]
        print(f"🔍 Индексы аудита: {audit_indexes}")
        
        # Проверяем триггеры
        cursor = await db.execute("SELECT name FROM sqlite_master WHERE type='trigger'")
        triggers = [row[0] for row in await cursor.fetchall()]
        reports_triggers = [trg for trg in triggers if 'reports' in trg.lower()]
        print(f"⚡ Триггеры отчетов: {reports_triggers}")
        
        print("✅ Проверка завершена!")

if __name__ == "__main__":
    print("🚀 Запуск миграции системы аудита отчетов")
    print("=" * 50)
    
    asyncio.run(migrate_reports_audit())
    asyncio.run(verify_migration())
    
    print("\n" + "=" * 50)
    print("🎉 Миграция завершена! Теперь можно:")
    print("1️⃣  Обновить main.py (добавить API аудита)")
    print("2️⃣  Обновить ReportsPage.jsx (режим редактирования)")
    print("3️⃣  Перезапустить сервер")
    print("4️⃣  Протестировать функциональность")