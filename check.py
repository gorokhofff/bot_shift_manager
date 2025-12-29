import sqlite3

# Убедись, что имя файла БД правильное
DB_NAME = "ырш.db"

def check_work_plans_columns():
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        # Этот запрос покажет информацию о колонках таблицы work_plans
        cursor.execute("PRAGMA table_info(work_plans);")
        columns = cursor.fetchall()
        
        print(f"\n--- КОЛОНКИ ТАБЛИЦЫ work_plans ---")
        print(f"{'ID':<5} {'ИМЯ КОЛОНКИ':<20} {'ТИП ДАННЫХ'}")
        print("-" * 40)
        for col in columns:
            # col[1] - это имя, col[2] - это тип
            print(f"{col[0]:<5} {col[1]:<20} {col[2]}")
        print("-" * 40 + "\n")
        
        conn.close()
    except Exception as e:
        print(f"Ошибка: {e}")

if __name__ == "__main__":
    check_work_plans_columns()