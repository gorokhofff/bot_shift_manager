import sqlite3
import os
from datetime import datetime, timedelta

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "data", "shift_manager.db")

def deactivate_old_users():
    if not os.path.exists(DB_PATH):
        print("❌ База данных не найдена")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Дата отсечения (сегодня - 30 дней)
    cutoff_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    print(f"📅 Ищем сотрудников, не работавших с {cutoff_date}...")

    # Находим ID активных пользователей, у которых последняя смена была давно
    cursor.execute('''
        SELECT u.id, u.name, MAX(s.start_time) as last_shift
        FROM Users u
        LEFT JOIN Shifts s ON u.id = s.user_id
        WHERE u.status = 'active'
        GROUP BY u.id
        HAVING last_shift < ? OR last_shift IS NULL
    ''', (cutoff_date,))
    
    users_to_deactivate = cursor.fetchall()

    if not users_to_deactivate:
        print("✅ Нет сотрудников для деактивации.")
        conn.close()
        return

    print(f"⚠️ Найдено {len(users_to_deactivate)} неактивных сотрудников:")
    
    for user in users_to_deactivate:
        uid, name, last = user
        last_str = last if last else "Никогда"
        print(f"   - {name} (ID: {uid}). Последняя смена: {last_str}")
        
        # Обновляем статус
        cursor.execute("UPDATE Users SET status = 'inactive' WHERE id = ?", (uid,))

    conn.commit()
    print(f"✅ Успешно деактивировано {len(users_to_deactivate)} сотрудников.")
    conn.close()

if __name__ == "__main__":
    deactivate_old_users()