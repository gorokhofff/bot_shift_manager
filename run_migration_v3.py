import sqlite3
import os

# Определяем пути
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data", "shift_manager.db")
MIGRATION_FILE = os.path.join(BASE_DIR, "migrations", "migration_v3_overtime.sql")

def run_migration():
    print(f"🔌 Подключение к базе данных: {DB_PATH}")
    
    if not os.path.exists(DB_PATH):
        print(f"❌ Ошибка: База данных не найдена по пути {DB_PATH}")
        return

    if not os.path.exists(MIGRATION_FILE):
        print(f"❌ Ошибка: Файл миграции не найден по пути {MIGRATION_FILE}")
        return

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        # Читаем SQL файл
        with open(MIGRATION_FILE, 'r', encoding='utf-8') as f:
            sql_script = f.read()

        print("🔄 Выполнение миграции...")
        
        # SQLite не поддерживает "IF NOT EXISTS" для добавления колонок,
        # поэтому выполняем команды по одной и ловим ошибки, если колонка уже есть.
        commands = sql_script.split(';')
        for command in commands:
            command = command.strip()
            if command:
                try:
                    cursor.execute(command)
                except sqlite3.OperationalError as e:
                    if "duplicate column name" in str(e):
                        print(f"⚠️  Предупреждение: {e} (пропускаем)")
                    else:
                        raise e

        conn.commit()
        print("✅ Миграция успешно выполнена!")

        # Проверка результатов
        print("\n🔎 Проверка структуры таблицы payroll_entries:")
        cursor.execute("PRAGMA table_info(payroll_entries)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if "overtime_pay" in columns and "missed_days_off" in columns:
            print("🆗 Новые колонки 'overtime_pay' и 'missed_days_off' существуют.")
        else:
            print("❌ ВНИМАНИЕ: Новые колонки НЕ найдены!")

        # Проверка таблицы employee_schedules
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='employee_schedules'")
        if cursor.fetchone():
             print("🆗 Таблица 'employee_schedules' создана.")
        else:
             print("❌ Таблица 'employee_schedules' НЕ создана.")

        conn.close()

    except Exception as e:
        print(f"\n❌ Критическая ошибка: {e}")

if __name__ == "__main__":
    run_migration()