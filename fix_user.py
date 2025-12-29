import sqlite3
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data", "shift_manager.db")

# Список пользователей из вашего сообщения
USERS_TO_FIX = [
    "Vepa",
    "Faruk yılmaz",
    "Hemra",
    "Emre Can Demir",
    "Gülşat Gutlyyewa",
    "Emircan kılıç",
    "Dovran",
    "Sohbet Jumanyazov"
]

def fix_database():
    if not os.path.exists(DB_PATH):
        print("❌ База данных не найдена!")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("🚀 Начинаем очистку и деактивацию...\n")

    for name in USERS_TO_FIX:
        # 1. Находим ID пользователя
        # Используем LIKE для нечувствительности к регистру
        cursor.execute("SELECT id, name FROM Users WHERE name LIKE ?", (name,))
        user = cursor.fetchone()

        if not user:
            print(f"⚠️ Пользователь '{name}' не найден в базе.")
            continue

        user_id = user[0]
        real_name = user[1]

        # 2. Удаляем открытые смены (где end_time IS NULL)
        cursor.execute("DELETE FROM Shifts WHERE user_id = ? AND end_time IS NULL", (user_id,))
        deleted_shifts = cursor.rowcount

        # 3. Деактивируем пользователя
        cursor.execute("UPDATE Users SET status = 'inactive' WHERE id = ?", (user_id,))
        
        print(f"✅ {real_name}:")
        print(f"   - Удалено зависших смен: {deleted_shifts}")
        print(f"   - Статус изменен на 'inactive'")

    conn.commit()
    conn.close()
    print("\n🎉 Готово!")

if __name__ == "__main__":
    fix_database()