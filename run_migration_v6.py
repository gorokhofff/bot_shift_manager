import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data", "shift_manager.db")

def run_migration():
    print(f"🔌 Подключение к: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("🛠 Создание таблицы reports_audit...")
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS reports_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_id INTEGER NOT NULL,
        version INTEGER DEFAULT 1,
        previous_text TEXT,
        new_text TEXT,
        change_reason TEXT,
        changed_fields TEXT,
        action_type TEXT DEFAULT 'UPDATE',
        user_id INTEGER,
        created_at TEXT DEFAULT (datetime('now', 'localtime')),
        FOREIGN KEY(report_id) REFERENCES Reports(id)
    );
    """)
    
    # Добавим колонку updated_at в Reports, если нет
    try:
        cursor.execute("ALTER TABLE Reports ADD COLUMN updated_at TEXT")
    except:
        pass

    conn.commit()
    conn.close()
    print("✅ Миграция успешно завершена!")

if __name__ == "__main__":
    run_migration()