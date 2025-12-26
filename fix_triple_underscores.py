#!/usr/bin/env python3
import sqlite3
import re
from datetime import datetime

DB_PATH = "shift_manager.db"

def fix_triple_underscores_in_reports():
    """Исправляет только ___ (три подчеркивания) в report_text на пустые строки"""
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        print("🔍 Анализируем отчеты с тройными подчеркиваниями...")
        
        # Находим все отчеты с тройными подчеркиваниями (но не длинными разделителями)
        cursor.execute("""
            SELECT id, report_text 
            FROM Reports 
            WHERE report_text LIKE '%___%'
        """)
        
        all_reports = cursor.fetchall()
        
        # Фильтруем только те, где есть именно "___" (а не длинные разделители)
        reports_to_fix = []
        for report_id, text in all_reports:
            if text and '___' in text:
                # Проверяем что это не длинный разделитель
                if re.search(r'(?<!_)___(?!_)', text):  # ровно три подчеркивания, не больше
                    reports_to_fix.append((report_id, text))
        
        print(f"📊 Найдено {len(reports_to_fix)} отчетов с тройными подчеркиваниями для исправления")
        
        if len(reports_to_fix) == 0:
            print("✅ Нет отчетов для исправления!")
            return
        
        # Показываем примеры того что будем исправлять
        print("\n📋 Примеры найденных проблем:")
        for i, (report_id, text) in enumerate(reports_to_fix[:5]):
            # Находим строки с ___
            lines_with_underscores = []
            for line in text.split('\n'):
                if re.search(r'(?<!_)___(?!_)', line):
                    lines_with_underscores.append(line.strip())
            
            print(f"   ID {report_id}:")
            for line in lines_with_underscores[:2]:  # Показываем первые 2 проблемные строки
                print(f"      '{line}'")
            if len(lines_with_underscores) > 2:
                print(f"      ... и еще {len(lines_with_underscores) - 2} строк")
        
        if len(reports_to_fix) > 5:
            print(f"   ... и еще {len(reports_to_fix) - 5} отчетов")
        
        # Спрашиваем подтверждение
        confirm = input(f"\n❓ Исправить {len(reports_to_fix)} отчетов? (y/N): ").lower().strip()
        if confirm != 'y':
            print("❌ Операция отменена")
            return
        
        print("\n🔧 Исправляем отчеты...")
        fixed_count = 0
        
        for report_id, original_text in reports_to_fix:
            if not original_text:
                continue
                
            # Заменяем только тройные подчеркивания (не длинные разделители)
            fixed_text = re.sub(r'(?<!_)___(?!_)', '', original_text)
            
            # Убираем лишние пробелы после замены
            fixed_text = re.sub(r'[ \t]+\n', '\n', fixed_text)  # Пробелы перед переносом
            fixed_text = re.sub(r'\n[ \t]+', '\n', fixed_text)  # Пробелы после переноса
            fixed_text = re.sub(r'[ \t]{2,}', ' ', fixed_text)  # Множественные пробелы
            
            if fixed_text != original_text:
                # Обновляем отчет
                cursor.execute(
                    "UPDATE Reports SET report_text = ? WHERE id = ?",
                    (fixed_text, report_id)
                )
                fixed_count += 1
                
                print(f"   ✅ Исправлен отчет ID {report_id}")
                
                # Показываем пример изменения для первых 3 отчетов
                if fixed_count <= 3:
                    print(f"      Изменения:")
                    orig_lines = original_text.split('\n')
                    fixed_lines = fixed_text.split('\n')
                    
                    for i, (orig_line, fixed_line) in enumerate(zip(orig_lines, fixed_lines)):
                        if orig_line != fixed_line and '___' in orig_line:
                            print(f"        Строка {i+1}: '{orig_line.strip()}' → '{fixed_line.strip()}'")
        
        # Сохраняем изменения
        conn.commit()
        print(f"\n✅ Успешно исправлено {fixed_count} отчетов!")
        
        # Проверяем результат
        cursor.execute("""
            SELECT COUNT(*) 
            FROM Reports 
            WHERE report_text REGEXP '(?<!_)___(?!_)'
        """)
        
        # Альтернативная проверка для SQLite
        cursor.execute("""
            SELECT id, report_text 
            FROM Reports 
            WHERE report_text LIKE '%___%'
        """)
        
        remaining_reports = cursor.fetchall()
        still_has_triple = 0
        for report_id, text in remaining_reports:
            if text and re.search(r'(?<!_)___(?!_)', text):
                still_has_triple += 1
        
        if still_has_triple > 0:
            print(f"⚠️  Осталось {still_has_triple} отчетов с тройными подчеркиваниями")
        else:
            print("🎉 Все тройные подчеркивания успешно убраны!")
            
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        conn.rollback()
    finally:
        conn.close()

def show_examples():
    """Показывает примеры отчетов с тройными подчеркиваниями"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT id, report_text 
            FROM Reports 
            WHERE report_text LIKE '%___%'
            LIMIT 10
        """)
        
        all_reports = cursor.fetchall()
        
        # Фильтруем только с тройными подчеркиваниями
        reports_with_triple = []
        for report_id, text in all_reports:
            if text and re.search(r'(?<!_)___(?!_)', text):
                reports_with_triple.append((report_id, text))
        
        print(f"\n📋 Примеры отчетов с тройными подчеркиваниями:")
        print(f"Найдено {len(reports_with_triple)} отчетов из {len(all_reports)} проверенных")
        
        for i, (report_id, text) in enumerate(reports_with_triple[:3]):
            print(f"\n--- ID {report_id} ---")
            lines = text.split('\n')
            for j, line in enumerate(lines[:10]):  # Показываем первые 10 строк
                if '___' in line:
                    if re.search(r'(?<!_)___(?!_)', line):
                        print(f"  {j+1:2d}: {line} ← ПРОБЛЕМА")
                    else:
                        print(f"  {j+1:2d}: {line} ← разделитель (ОК)")
                else:
                    print(f"  {j+1:2d}: {line}")
            
            if len(lines) > 10:
                print(f"       ... еще {len(lines) - 10} строк")
            
    except Exception as e:
        print(f"❌ Ошибка: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    print("🛠️  Скрипт исправления тройных подчеркиваний в отчетах")
    print("=" * 60)
    print("Заменяем только ___ (три подчеркивания) на пустые строки")
    print("Длинные разделители (____+) оставляем без изменений")
    print("=" * 60)
    
    # Сначала показываем что найдено
    show_examples()
    
    # Затем исправляем
    fix_triple_underscores_in_reports()
    
    print("\n" + "=" * 60)
    print("🎯 Готово! Теперь парсер должен работать лучше!")