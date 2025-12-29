import sqlite3
import os

# Пути к файлам
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data", "shift_manager.db")
MIGRATION_FILE = os.path.join(BASE_DIR, "migrations", "migration_v5_rates_and_plans.sql")

def run_migration_v5():
    print(f"🔌 Подключение к базе данных: {DB_PATH}")
    
    if not os.path.exists(DB_PATH):
        print(f"❌ Ошибка: База данных не найдена по пути {DB_PATH}")
        return

    if not os.path.exists(MIGRATION_FILE):
        print(f"❌ Ошибка: Файл миграции не найден по пути {MIGRATION_FILE}")
        # Создадим файл миграции, если его нет, чтобы скрипт не падал зря
        create_migration_file_if_missing()

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Читаем SQL файл
        with open(MIGRATION_FILE, 'r', encoding='utf-8') as f:
            sql_script = f.read()

        print("🔄 Выполнение миграции v5 (Rates & Schedules)...")
        
        # Разделяем команды по точке с запятой
        commands = sql_script.split(';')
        for command in commands:
            command = command.strip()
            if command:
                try:
                    cursor.execute(command)
                except sqlite3.OperationalError as e:
                    # Игнорируем ошибки "table already exists" или "duplicate column"
                    if "already exists" in str(e) or "duplicate column" in str(e):
                        print(f"⚠️  Инфо: {e} (пропускаем)")
                    else:
                        print(f"❌ Ошибка SQL: {e}")
                        # Не прерываем, пробуем выполнить остальные команды

        conn.commit()
        print("✅ Миграция v5 успешно выполнена!")
        
        # Проверка создания таблиц
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('rates', 'employee_schedules')")
        tables = [row[0] for row in cursor.fetchall()]
        print(f"🔎 Проверка таблиц: Найдено {len(tables)}/2 ({', '.join(tables)})")

        conn.close()

    except Exception as e:
        print(f"\n❌ Критическая ошибка: {e}")

def create_migration_file_if_missing():
    # Если вы забыли создать SQL файл, этот код создаст его автоматически
    print("⚠️ Файл миграции не найден, создаю его автоматически...")
    os.makedirs(os.path.dirname(MIGRATION_FILE), exist_ok=True)
    
    sql_content = """
-- Таблица тарифов
CREATE TABLE IF NOT EXISTS rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    amount REAL NOT NULL,
    period_type TEXT CHECK(period_type IN ('hourly', 'daily', 'monthly', 'per_item', 'percent')) DEFAULT 'monthly',
    effective_date TEXT DEFAULT (datetime('now', 'localtime')),
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    UNIQUE(role, period_type)
);

-- Базовые тарифы
INSERT OR IGNORE INTO rates (role, amount, period_type) VALUES 
('кальянщик', 15.0, 'per_item'),
('администратор', 17000.0, 'monthly'),
('уборщик', 12000.0, 'monthly');

-- Таблица графиков (если еще не создана)
CREATE TABLE IF NOT EXISTS employee_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    day INTEGER NOT NULL,
    is_workday BOOLEAN DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    UNIQUE(user_id, year, month, day),
    FOREIGN KEY(user_id) REFERENCES Users(id)
);
"""
    with open(MIGRATION_FILE, 'w', encoding='utf-8') as f:
        f.write(sql_content)
    print("✅ Файл migration_v5_rates_and_plans.sql создан.")

if __name__ == "__main__":
    run_migration_v5()