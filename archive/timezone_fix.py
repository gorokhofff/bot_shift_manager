#!/usr/bin/env python3
"""
Скрипт для исправления ошибки часового пояса в старых записях смен
Добавляет 3 часа к duration_hours в записях, где shift_date = DATE(start_time)
"""

import asyncio
import aiosqlite
import shutil
from datetime import datetime

DB_NAME = "shift_manager.db"

async def create_backup():
    """Создает резервную копию базы данных"""
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_name = f"shift_manager_backup_timezone_fix_{timestamp}.db"
    
    try:
        shutil.copy2(DB_NAME, backup_name)
        print(f"✅ Резервная копия создана: {backup_name}")
        return backup_name
    except Exception as e:
        print(f"❌ Ошибка создания резервной копии: {e}")
        return None

async def analyze_data():
    """Анализирует данные перед исправлением"""
    print("\n📊 АНАЛИЗ ДАННЫХ ПЕРЕД ИСПРАВЛЕНИЕМ")
    print("=" * 60)
    
    async with aiosqlite.connect(DB_NAME) as db:
        # Записи, которые будут исправлены
        cursor = await db.execute("""
            SELECT COUNT(*) 
            FROM Shifts 
            WHERE shift_date = DATE(start_time) 
                AND duration_hours IS NOT NULL 
                AND duration_hours > 0
        """)
        to_fix = (await cursor.fetchone())[0]
        
        # Записи, которые останутся без изменений
        cursor = await db.execute("""
            SELECT COUNT(*) 
            FROM Shifts 
            WHERE shift_date != DATE(start_time) 
                AND duration_hours IS NOT NULL 
                AND duration_hours > 0
        """)
        unchanged = (await cursor.fetchone())[0]
        
        print(f"📝 Записей к исправлению (shift_date = DATE(start_time)): {to_fix}")
        print(f"📝 Записей без изменений (shift_date != DATE(start_time)): {unchanged}")
        
        # Показываем примеры
        if to_fix > 0:
            print(f"\n🔍 ПРИМЕРЫ ЗАПИСЕЙ К ИСПРАВЛЕНИЮ (первые 5):")
            cursor = await db.execute("""
                SELECT s.id, u.name, s.start_time, s.shift_date, s.duration_hours, 
                       (s.duration_hours + 3) as new_hours
                FROM Shifts s
                JOIN Users u ON s.user_id = u.id
                WHERE s.shift_date = DATE(s.start_time) 
                    AND s.duration_hours IS NOT NULL 
                    AND s.duration_hours > 0
                LIMIT 5
            """)
            
            records = await cursor.fetchall()
            for record in records:
                print(f"  ID {record[0]}: {record[1]} | {record[2]} | {record[3]} | {record[4]}ч → {record[5]}ч")
        
        return to_fix, unchanged

async def fix_timezone_data():
    """Исправляет данные о времени"""
    print(f"\n🔧 ИСПРАВЛЕНИЕ ДАННЫХ")
    print("=" * 60)
    
    async with aiosqlite.connect(DB_NAME) as db:
        # Выполняем исправление
        cursor = await db.execute("""
            UPDATE Shifts 
            SET duration_hours = duration_hours + 3
            WHERE shift_date = DATE(start_time) 
                AND duration_hours IS NOT NULL 
                AND duration_hours > 0
        """)
        
        affected_rows = cursor.rowcount
        await db.commit()
        
        print(f"✅ Исправлено записей: {affected_rows}")
        
        return affected_rows

async def verify_results():
    """Проверяет результаты исправления"""
    print(f"\n✅ ПРОВЕРКА РЕЗУЛЬТАТОВ")
    print("=" * 60)
    
    async with aiosqlite.connect(DB_NAME) as db:
        # Общая статистика
        cursor = await db.execute("""
            SELECT 
                COUNT(*) as total,
                ROUND(MIN(duration_hours), 2) as min_hours,
                ROUND(MAX(duration_hours), 2) as max_hours,
                ROUND(AVG(duration_hours), 2) as avg_hours
            FROM Shifts 
            WHERE duration_hours IS NOT NULL AND duration_hours > 0
        """)
        
        stats = await cursor.fetchone()
        print(f"📊 Общая статистика:")
        print(f"   Всего смен: {stats[0]}")
        print(f"   Мин. часов: {stats[1]}")
        print(f"   Макс. часов: {stats[2]}")
        print(f"   Средн. часов: {stats[3]}")
        
        # Статистика по пользователям
        print(f"\n👥 СТАТИСТИКА ПО СОТРУДНИКАМ:")
        cursor = await db.execute("""
            SELECT 
                u.name,
                COUNT(s.id) as total_shifts,
                SUM(CASE WHEN s.shift_date = DATE(s.start_time) THEN 1 ELSE 0 END) as auto_shifts,
                SUM(CASE WHEN s.shift_date != DATE(s.start_time) THEN 1 ELSE 0 END) as manual_shifts,
                ROUND(AVG(s.duration_hours), 2) as avg_hours
            FROM Shifts s
            JOIN Users u ON s.user_id = u.id
            WHERE s.duration_hours IS NOT NULL AND s.duration_hours > 0
            GROUP BY u.id, u.name
            ORDER BY u.name
        """)
        
        users = await cursor.fetchall()
        for user in users:
            print(f"   {user[0]}: {user[1]} смен (авто: {user[2]}, ручн: {user[3]}) | ср. {user[4]}ч")

async def main():
    print("🕐 ИСПРАВЛЕНИЕ ОШИБКИ ЧАСОВОГО ПОЯСА В ЗАПИСЯХ СМЕН")
    print("=" * 60)
    print("Этот скрипт добавит 3 часа к записям, где shift_date = DATE(start_time)")
    print("Записи с ручным вводом (shift_date != DATE(start_time)) останутся без изменений")
    print()
    
    # Создаем резервную копию
    backup_file = await create_backup()
    if not backup_file:
        print("❌ Не удалось создать резервную копию. Операция отменена.")
        return
    
    # Анализируем данные
    to_fix, unchanged = await analyze_data()
    
    if to_fix == 0:
        print("ℹ️  Записей для исправления не найдено. Все данные уже корректны.")
        return
    
    # Подтверждение от пользователя
    print(f"\n⚠️  ВНИМАНИЕ!")
    print(f"   Будет исправлено: {to_fix} записей")
    print(f"   Без изменений: {unchanged} записей")
    print(f"   Резервная копия: {backup_file}")
    print()
    
    confirm = input("Продолжить исправление? (yes/NO): ").lower().strip()
    if confirm != 'yes':
        print("❌ Операция отменена пользователем")
        return
    
    # Выполняем исправление
    fixed_count = await fix_timezone_data()
    
    if fixed_count != to_fix:
        print(f"⚠️  Предупреждение: ожидалось {to_fix} записей, исправлено {fixed_count}")
    
    # Проверяем результаты
    await verify_results()
    
    print(f"\n🎉 ИСПРАВЛЕНИЕ ЗАВЕРШЕНО!")
    print(f"✅ Исправлено записей: {fixed_count}")
    print(f"💾 Резервная копия: {backup_file}")
    print(f"📊 Проверьте результаты в веб-интерфейсе Shift Summary")

if __name__ == "__main__":
    asyncio.run(main())