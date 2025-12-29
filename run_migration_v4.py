import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data", "shift_manager.db")
MIGRATION_FILE = os.path.join(BASE_DIR, "migrations", "migration_v4_payroll_v2.sql")

def run_migration():
    print(f"🔌 Подключение к базе: {DB_PATH}")
    if not os.path.exists(DB_PATH):
        print("❌ База данных не найдена!")
        return

    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        with open(MIGRATION_FILE, 'r', encoding='utf-8') as f:
            sql_script = f.read()

        print("🔄 Выполнение миграции v4...")
        commands = sql_script.split(';')
        for command in commands:
            command = command.strip()
            if command:
                try:
                    cursor.execute(command)
                except sqlite3.OperationalError as e:
                    # Игнорируем ошибки "duplicate column", если запускаем повторно
                    if "duplicate column" in str(e):
                        continue
                    else:
                        print(f"⚠️ Ошибка SQL (возможно не критична): {e}")

        conn.commit()
        print("✅ Миграция v4 успешно выполнена! (Таблица планов и новые поля добавлены)")
        conn.close()

    except Exception as e:
        print(f"❌ Критическая ошибка: {e}")

if __name__ == "__main__":
    run_migration()