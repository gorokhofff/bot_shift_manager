import sqlite3
import os

# Определяем правильный путь к БД
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data", "shift_manager.db")

print(f"🔧 Запуск восстановления системы...")
print(f"📂 Путь к БД: {DB_PATH}")

if not os.path.exists(os.path.dirname(DB_PATH)):
    os.makedirs(os.path.dirname(DB_PATH))
    print("   Создана папка data/")

def repair_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    try:
        # 1. ВОССТАНОВЛЕНИЕ ТАБЛИЦЫ REPORTS
        print("1️⃣ Проверка таблицы Reports...")
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS Reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shift_id INTEGER,
            report_text TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(shift_id) REFERENCES Shifts(id)
        )
        ''')
        
        # Таблица аудита изменений отчетов
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS reports_audit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            report_id INTEGER,
            version INTEGER,
            previous_text TEXT,
            new_text TEXT,
            change_reason TEXT,
            changed_fields TEXT,
            action_type TEXT,
            user_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(report_id) REFERENCES Reports(id)
        )
        ''')
        print("   ✅ Таблицы отчетов (Reports, reports_audit) проверены/созданы.")

        # 2. ВОССТАНОВЛЕНИЕ РОЛЕЙ (Исправление прошлой ошибки)
        print("2️⃣ Инициализация ролей...")
        
        # Создаем таблицу ролей
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS roles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            slug TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            priority INTEGER DEFAULT 10
        )
        ''')

        # Создаем таблицу расписаний ролей (настроек времени)
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS role_schedules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            location TEXT NOT NULL,
            role TEXT NOT NULL,
            default_start_time TEXT NOT NULL,
            default_end_time TEXT NOT NULL,
            effective_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            effective_to TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')

        # Стандартные роли
        standard_roles = [
            ('admin', 'администратор', 1),
            ('senior_hookah', 'старший кальянщик', 2),
            ('hookah', 'кальянщик', 3),
            ('barman', 'бармен/зал', 4),
            ('cleaner', 'уборщик', 5),
            ('student', 'студент', 6)
        ]

        for slug, name, priority in standard_roles:
            try:
                cursor.execute('''
                    INSERT INTO roles (slug, name, priority) VALUES (?, ?, ?)
                    ON CONFLICT(slug) DO UPDATE SET name=excluded.name, priority=excluded.priority
                ''', (slug, name, priority))
            except Exception as e:
                print(f"   ⚠️ Ошибка добавления роли {name}: {e}")

        # Подтягиваем роли из таблицы Users (если они там есть строкой)
        print("   🔍 Синхронизация ролей пользователей...")
        try:
            cursor.execute("SELECT DISTINCT role FROM Users WHERE role IS NOT NULL AND role != ''")
            existing_roles = cursor.fetchall()
            for row in existing_roles:
                role_name = row[0]
                # Если такой роли нет в справочнике -> добавляем
                cursor.execute("SELECT 1 FROM roles WHERE name = ?", (role_name,))
                if not cursor.fetchone():
                    print(f"   ➕ Добавлена кастомная роль из Users: {role_name}")
                    slug = role_name.lower().replace(' ', '_').replace('/', '_')
                    # Защита от дублей slug
                    try:
                        cursor.execute("INSERT INTO roles (slug, name, priority) VALUES (?, ?, 99)", (slug, role_name))
                    except sqlite3.IntegrityError:
                        slug += "_custom"
                        cursor.execute("INSERT INTO roles (slug, name, priority) VALUES (?, ?, 99)", (slug, role_name))
        except sqlite3.OperationalError:
            print("   ⚠️ Таблица Users пока не создана или не имеет колонки role. Пропуск синхронизации.")

        # 3. БАЗОВЫЕ ТАБЛИЦЫ (На случай чистого запуска)
        print("3️⃣ Проверка базовых таблиц (Users, Shifts)...")
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS Users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id INTEGER UNIQUE,
            name TEXT,
            role TEXT,
            status TEXT DEFAULT 'active',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS Shifts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            start_time TIMESTAMP,
            end_time TIMESTAMP,
            location TEXT,
            duration_hours REAL,
            FOREIGN KEY(user_id) REFERENCES Users(id)
        )
        ''')
        
        # Таблица для веб-авторизации (админка)
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS web_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'admin',
            name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        conn.commit()
        print("✅ Восстановление завершено успешно!")
        print("   Теперь перезапустите backend командой: sudo systemctl restart shift-manager-backend (или ctrl+c -> uvicorn)")

    except Exception as e:
        print(f"❌ КРИТИЧЕСКАЯ ОШИБКА: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    repair_db()