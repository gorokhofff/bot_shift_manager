import sqlite3
import os
import hashlib
import secrets

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data", "shift_manager.db")

# Простая соль для хеширования (в продакшене лучше использовать bcrypt)
SALT = "super_secret_salt_shift_manager_2025"

def hash_password(password):
    return hashlib.sha256((password + SALT).encode()).hexdigest()

USERS_TO_CREATE = [
    {"username": "alinayil",   "password": "Lina1!", "role": "manager", "name": "Alina"},
    {"username": "guvanch",    "password": "Guva2@", "role": "manager", "name": "Guvanch"},
    {"username": "a.gorokhov", "password": "Boss3#", "role": "admin",   "name": "Alex"},
]

def run_migration():
    print(f"🔌 Подключение к базе: {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("🛠 Создание таблицы web_users...")
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS web_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'manager', -- 'admin' or 'manager'
        name TEXT,
        created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
    """)

    print("👤 Добавление пользователей...")
    for user in USERS_TO_CREATE:
        p_hash = hash_password(user['password'])
        try:
            cursor.execute("""
                INSERT INTO web_users (username, password_hash, role, name)
                VALUES (?, ?, ?, ?)
            """, (user['username'], p_hash, user['role'], user['name']))
            print(f"   ✅ Пользователь {user['username']} создан.")
        except sqlite3.IntegrityError:
            # Если пользователь уже есть, обновим пароль и роль
            cursor.execute("""
                UPDATE web_users 
                SET password_hash = ?, role = ?, name = ?
                WHERE username = ?
            """, (p_hash, user['role'], user['name'], user['username']))
            print(f"   🔄 Пользователь {user['username']} обновлен.")

    conn.commit()
    conn.close()
    print("✅ Миграция завершена! Пользователи готовы к входу.")

if __name__ == "__main__":
    run_migration()