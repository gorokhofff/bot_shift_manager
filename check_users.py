import asyncio
import aiosqlite
from datetime import datetime

DB_NAME = "/home/admin/bot_shift_manager/shift_manager.db"

# Пары для объединения: (старый_id, новый_актуальный_id)
USER_MERGE_PAIRS = [
    (29, 86),  # user id 29 объединяем с id 86 (актуальный)
    (18, 87),  # user id 18 объединяем с id 87 (актуальный)
    (4, 88),   # user id 4 объединяем с id 88 (актуальный)
]

async def merge_users():
    """Объединяет дублированных пользователей"""
    
    async with aiosqlite.connect(DB_NAME) as db:
        print("🔄 Начинаем объединение дублированных пользователей...")
        
        # Включаем поддержку foreign keys
        await db.execute("PRAGMA foreign_keys = ON")
        
        for old_user_id, new_user_id in USER_MERGE_PAIRS:
            print(f"\n📋 Обрабатываем пару: {old_user_id} → {new_user_id}")
            
            try:
                # 1. Проверяем существование обоих пользователей
                cursor = await db.execute("SELECT id, name, telegram_id, status FROM Users WHERE id = ?", (old_user_id,))
                old_user = await cursor.fetchone()
                
                cursor = await db.execute("SELECT id, name, telegram_id, status FROM Users WHERE id = ?", (new_user_id,))
                new_user = await cursor.fetchone()
                
                if not old_user:
                    print(f"⚠️  Старый пользователь {old_user_id} не найден, пропускаем")
                    continue
                    
                if not new_user:
                    print(f"⚠️  Новый пользователь {new_user_id} не найден, пропускаем")
                    continue
                
                print(f"👤 Старый: ID={old_user[0]}, Name='{old_user[1]}', Telegram={old_user[2]}, Status='{old_user[3]}'")
                print(f"👤 Новый: ID={new_user[0]}, Name='{new_user[1]}', Telegram={new_user[2]}, Status='{new_user[3]}'")
                
                # 2. Переносим смены (Shifts)
                cursor = await db.execute("SELECT COUNT(*) FROM Shifts WHERE user_id = ?", (old_user_id,))
                shifts_count = (await cursor.fetchone())[0]
                
                if shifts_count > 0:
                    print(f"📊 Переносим {shifts_count} смен...")
                    await db.execute("UPDATE Shifts SET user_id = ? WHERE user_id = ?", (new_user_id, old_user_id))
                    print(f"✅ Перенесено {shifts_count} смен")
                else:
                    print("📊 Смен для переноса нет")
                
                # 3. Переносим данные ФОТ (payroll_entries) если есть
                try:
                    cursor = await db.execute("SELECT COUNT(*) FROM payroll_entries WHERE user_id = ?", (old_user_id,))
                    payroll_count = (await cursor.fetchone())[0]
                    
                    if payroll_count > 0:
                        print(f"💰 Переносим {payroll_count} записей ФОТ...")
                        await db.execute("UPDATE payroll_entries SET user_id = ? WHERE user_id = ?", (new_user_id, old_user_id))
                        print(f"✅ Перенесено {payroll_count} записей ФОТ")
                    else:
                        print("💰 Записей ФОТ для переноса нет")
                except Exception as e:
                    print(f"⚠️  Таблица payroll_entries не найдена или ошибка: {e}")
                
                # 4. Переносим расписания сотрудников (employee_schedules) если есть
                try:
                    cursor = await db.execute("SELECT COUNT(*) FROM employee_schedules WHERE user_id = ?", (old_user_id,))
                    schedule_count = (await cursor.fetchone())[0]
                    
                    if schedule_count > 0:
                        print(f"📅 Переносим {schedule_count} записей расписания...")
                        await db.execute("UPDATE employee_schedules SET user_id = ? WHERE user_id = ?", (new_user_id, old_user_id))
                        print(f"✅ Перенесено {schedule_count} записей расписания")
                    else:
                        print("📅 Записей расписания для переноса нет")
                except Exception as e:
                    print(f"⚠️  Таблица employee_schedules не найдена или ошибка: {e}")
                
                # 5. Переносим аудит ФОТ (payroll_audit_log) если есть - по полю changed_by
                try:
                    cursor = await db.execute("SELECT COUNT(*) FROM payroll_audit_log WHERE changed_by = ?", (old_user_id,))
                    audit_count = (await cursor.fetchone())[0]
                    
                    if audit_count > 0:
                        print(f"📋 Переносим {audit_count} записей аудита ФОТ...")
                        await db.execute("UPDATE payroll_audit_log SET changed_by = ? WHERE changed_by = ?", (new_user_id, old_user_id))
                        print(f"✅ Перенесено {audit_count} записей аудита")
                    else:
                        print("📋 Записей аудита для переноса нет")
                except Exception as e:
                    print(f"⚠️  Таблица payroll_audit_log не найдена или ошибка: {e}")
                
                # 6. Переносим отчеты об изменениях (ReportsAuditLog) если есть
                try:
                    cursor = await db.execute("SELECT COUNT(*) FROM ReportsAuditLog WHERE changed_by = ?", (old_user_id,))
                    reports_audit_count = (await cursor.fetchone())[0]
                    
                    if reports_audit_count > 0:
                        print(f"📝 Переносим {reports_audit_count} записей аудита отчетов...")
                        await db.execute("UPDATE ReportsAuditLog SET changed_by = ? WHERE changed_by = ?", (new_user_id, old_user_id))
                        print(f"✅ Перенесено {reports_audit_count} записей аудита отчетов")
                    else:
                        print("📝 Записей аудита отчетов для переноса нет")
                except Exception as e:
                    print(f"⚠️  Таблица ReportsAuditLog не найдена или ошибка: {e}")
                
                # 7. Переносим сессии редактирования (ReportsEditSessions) если есть
                try:
                    cursor = await db.execute("SELECT COUNT(*) FROM ReportsEditSessions WHERE user_id = ?", (old_user_id,))
                    edit_sessions_count = (await cursor.fetchone())[0]
                    
                    if edit_sessions_count > 0:
                        print(f"✏️  Переносим {edit_sessions_count} сессий редактирования...")
                        await db.execute("UPDATE ReportsEditSessions SET user_id = ? WHERE user_id = ?", (new_user_id, old_user_id))
                        print(f"✅ Перенесено {edit_sessions_count} сессий редактирования")
                    else:
                        print("✏️  Сессий редактирования для переноса нет")
                except Exception as e:
                    print(f"⚠️  Таблица ReportsEditSessions не найдена или ошибка: {e}")
                
                # 8. Проверяем отчеты (Reports) через связь с Shifts
                cursor = await db.execute("""
                    SELECT COUNT(*) 
                    FROM Reports r 
                    JOIN Shifts s ON r.shift_id = s.id 
                    WHERE s.user_id = ?
                """, (new_user_id,))
                reports_count = (await cursor.fetchone())[0]
                print(f"📄 Отчетов связанных с пользователем (через смены): {reports_count}")
                
                # 9. Сохраняем изменения перед удалением
                await db.commit()
                print("💾 Изменения сохранены")
                
                # 10. Удаляем старого пользователя
                print(f"🗑️  Удаляем старого пользователя {old_user_id}...")
                await db.execute("DELETE FROM Users WHERE id = ?", (old_user_id,))
                
                # 11. Финальное сохранение
                await db.commit()
                print(f"✅ Пользователь {old_user_id} успешно объединен с {new_user_id}")
                
            except Exception as e:
                print(f"❌ Ошибка при обработке пары {old_user_id} → {new_user_id}: {e}")
                # Откатываем транзакцию для этой пары
                await db.rollback()
                continue
        
        print("\n🎉 Объединение пользователей завершено!")
        
        # Финальная статистика
        print("\n📊 Финальная статистика:")
        for old_user_id, new_user_id in USER_MERGE_PAIRS:
            try:
                # Проверяем что старый пользователь удален
                cursor = await db.execute("SELECT COUNT(*) FROM Users WHERE id = ?", (old_user_id,))
                old_exists = (await cursor.fetchone())[0]
                
                # Проверяем данные нового пользователя
                cursor = await db.execute("SELECT COUNT(*) FROM Shifts WHERE user_id = ?", (new_user_id,))
                shifts_count = (await cursor.fetchone())[0]
                
                cursor = await db.execute("SELECT name FROM Users WHERE id = ?", (new_user_id,))
                user_name_result = await cursor.fetchone()
                user_name = user_name_result[0] if user_name_result else "Unknown"
                
                status = "❌ Старый пользователь все еще существует!" if old_exists else "✅ Объединено успешно"
                print(f"  {new_user_id} ({user_name}): {shifts_count} смен | {status}")
                
            except Exception as e:
                print(f"  Ошибка проверки {old_user_id} → {new_user_id}: {e}")

async def verify_merge():
    """Проверяет результаты объединения"""
    
    async with aiosqlite.connect(DB_NAME) as db:
        print("\n🔍 Верификация результатов объединения:")
        
        for old_user_id, new_user_id in USER_MERGE_PAIRS:
            print(f"\n--- Проверка пары {old_user_id} → {new_user_id} ---")
            
            # Проверяем что старый пользователь удален
            cursor = await db.execute("SELECT * FROM Users WHERE id = ?", (old_user_id,))
            old_user = await cursor.fetchone()
            
            if old_user:
                print(f"⚠️  ВНИМАНИЕ: Старый пользователь {old_user_id} все еще существует!")
            else:
                print(f"✅ Старый пользователь {old_user_id} успешно удален")
            
            # Проверяем данные нового пользователя
            cursor = await db.execute("SELECT id, name, telegram_id, status FROM Users WHERE id = ?", (new_user_id,))
            new_user = await cursor.fetchone()
            
            if new_user:
                print(f"✅ Новый пользователь {new_user_id}: {new_user[1]} (Telegram: {new_user[2]})")
                
                # Считаем смены
                cursor = await db.execute("SELECT COUNT(*) FROM Shifts WHERE user_id = ?", (new_user_id,))
                shifts_count = (await cursor.fetchone())[0]
                print(f"   📊 Смен: {shifts_count}")
                
                # Считаем отчеты через смены
                cursor = await db.execute("""
                    SELECT COUNT(*) 
                    FROM Reports r 
                    JOIN Shifts s ON r.shift_id = s.id 
                    WHERE s.user_id = ?
                """, (new_user_id,))
                reports_count = (await cursor.fetchone())[0]
                print(f"   📄 Отчетов: {reports_count}")
                
            else:
                print(f"❌ ОШИБКА: Новый пользователь {new_user_id} не найден!")

if __name__ == "__main__":
    print("🚀 Запуск объединения дублированных пользователей")
    print("=" * 60)
    
    # Показываем что будем делать
    print("📋 Будут объединены следующие пары:")
    for old_id, new_id in USER_MERGE_PAIRS:
        print(f"  • User ID {old_id} → User ID {new_id} (актуальный)")
    
    # Запрашиваем подтверждение
    confirm = input("\n⚠️  Продолжить? Это действие необратимо! (yes/NO): ").strip().lower()
    
    if confirm == 'yes':
        asyncio.run(merge_users())
        asyncio.run(verify_merge())
    else:
        print("❌ Операция отменена")
    
    print("\n" + "=" * 60)
    print("🏁 Готово!")