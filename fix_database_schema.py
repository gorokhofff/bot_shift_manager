import sqlite3
import os

# Путь к базе данных
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data", "shift_manager.db")

# Список всех колонок, которые ОБЯЗАНЫ быть в таблице payroll_entries для работы v2
REQUIRED_COLUMNS = {
    "report_id": "INTEGER",
    "user_id": "INTEGER",
    "role": "TEXT",
    "sales_1_15": "INTEGER DEFAULT 0",
    "sales_16_31": "INTEGER DEFAULT 0",
    "total_sales": "INTEGER DEFAULT 0",
    "missed_days_off": "INTEGER DEFAULT 0",
    "overtime_pay": "REAL DEFAULT 0",
    "actual_hours": "REAL DEFAULT 0",
    "monthly_total": "REAL DEFAULT 0",
    "created_at": "TEXT DEFAULT (datetime('now'))",
    "updated_at": "TEXT DEFAULT (datetime('now'))",
    "monthly_tariff": "REAL DEFAULT 0",
    "motivation_percent": "REAL DEFAULT 0",
    "motivation_tl": "REAL DEFAULT 0",
    "hourly_rate_tl": "REAL DEFAULT 0",
    "advance_expenses": "REAL DEFAULT 0",
    "advance_paid": "BOOLEAN DEFAULT 0",
    "salary_expenses": "REAL DEFAULT 0",
    "salary_paid": "BOOLEAN DEFAULT 0",
    "salary_comment": "TEXT"
}

def fix_database():
    print(f"🔧 Проверка базы данных: {DB_PATH}")
    
    if not os.path.exists(DB_PATH):
        print("❌ База данных не найдена!")
        return

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # 1. Проверяем таблицу payroll_entries
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='payroll_entries'")
        if not cursor.fetchone():
            print("⚠️ Таблица payroll_entries не найдена. Создаю новую...")
            cursor.execute("""
                CREATE TABLE payroll_entries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    report_id INTEGER,
                    user_id INTEGER,
                    role TEXT,
                    created_at TEXT DEFAULT (datetime('now'))
                )
            """)
        
        # 2. Получаем текущие колонки
        cursor.execute("PRAGMA table_info(payroll_entries)")
        current_columns = [row[1] for row in cursor.fetchall()]
        print(f"📋 Текущие колонки: {current_columns}")

        # 3. Добавляем недостающие
        print("\n🔍 Поиск и добавление недостающих колонок...")
        added_count = 0
        
        for col_name, col_def in REQUIRED_COLUMNS.items():
            if col_name not in current_columns:
                try:
                    alter_query = f"ALTER TABLE payroll_entries ADD COLUMN {col_name} {col_def}"
                    print(f"   ➕ Добавляю колонку: {col_name}...")
                    cursor.execute(alter_query)
                    added_count += 1
                except Exception as e:
                    print(f"   ❌ Ошибка при добавлении {col_name}: {e}")

        # 4. Создаем индексы для скорости (если нет)
        try:
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_payroll_entries_report_id ON payroll_entries(report_id)")
        except:
            pass

        conn.commit()
        conn.close()
        
        if added_count > 0:
            print(f"\n✅ Успешно добавлено колонок: {added_count}")
        else:
            print("\n✅ Все необходимые колонки уже существуют.")
            
        print("🚀 База данных готова к работе!")

    except Exception as e:
        print(f"\n❌ Критическая ошибка: {e}")

if __name__ == "__main__":
    fix_database()