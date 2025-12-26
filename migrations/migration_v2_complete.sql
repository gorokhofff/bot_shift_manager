-- ============================================================================
-- МИГРАЦИЯ ФОТ v2.0 - ПОЛНЫЙ ПЕРЕХОД НА МЕСЯЧНУЮ СИСТЕМУ
-- ============================================================================

-- 1. СОЗДАНИЕ НОВОЙ ТАБЛИЦЫ ПЛАНОВ РАБОЧЕГО ВРЕМЕНИ
-- ============================================================================
CREATE TABLE IF NOT EXISTS work_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    planned_hours REAL NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
    UNIQUE(role, year, month)
);

-- Индекс для быстрого поиска планов
CREATE INDEX IF NOT EXISTS idx_work_plans_role_date ON work_plans(role, year, month);

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER IF NOT EXISTS update_work_plans_timestamp 
AFTER UPDATE ON work_plans
FOR EACH ROW 
BEGIN
    UPDATE work_plans 
    SET updated_at = datetime('now', 'localtime')
    WHERE id = NEW.id;
END;

-- 2. РАСШИРЕНИЕ ТАБЛИЦЫ RATES
-- ============================================================================
ALTER TABLE rates ADD COLUMN hourly_rate_tl REAL DEFAULT 0;

-- 3. СОЗДАНИЕ НОВОЙ СТРУКТУРЫ PAYROLL_REPORTS
-- ============================================================================

-- Создаем временную таблицу с новой структурой
CREATE TABLE payroll_reports_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    establishment_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    revenue REAL,
    total_hookahs INTEGER DEFAULT 0,
    status TEXT DEFAULT 'draft',
    created_by INTEGER,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY(created_by) REFERENCES Users(id)
);

-- Переносим данные из старой таблицы (если есть)
INSERT INTO payroll_reports_new (
    id, establishment_id, year, month, revenue, total_hookahs, 
    status, created_by, created_at, updated_at
)
SELECT 
    id, 
    establishment_id,
    CAST(strftime('%Y', period_start) AS INTEGER) as year,
    CAST(strftime('%m', period_start) AS INTEGER) as month,
    revenue,
    total_hookahs,
    status,
    created_by,
    created_at,
    updated_at
FROM payroll_reports 
WHERE id IN (SELECT MIN(id) FROM payroll_reports GROUP BY establishment_id, strftime('%Y-%m', period_start));

-- Удаляем старую таблицу и переименовываем новую
DROP TABLE payroll_reports;
ALTER TABLE payroll_reports_new RENAME TO payroll_reports;

-- 4. СОЗДАНИЕ НОВОЙ СТРУКТУРЫ PAYROLL_ENTRIES
-- ============================================================================

-- Создаем новую таблицу с полной структурой v2
CREATE TABLE payroll_entries_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payroll_report_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    
    -- Общая часть
    monthly_tariff REAL DEFAULT 0,           -- Тариф за месяц
    motivation_percent REAL DEFAULT 0,       -- % мотивации
    motivation_tl REAL DEFAULT 0,            -- Мотивация TL
    monthly_income REAL DEFAULT 0,           -- Доход за месяц (тариф + мотивация)
    planned_hours REAL DEFAULT 0,            -- План часов
    hourly_rate_tl REAL DEFAULT 0,          -- Ставка за час TL
    actual_hours REAL DEFAULT 0,            -- Факт часов
    monthly_total REAL DEFAULT 0,           -- Итого к выплате за месяц
    
    -- Аванс (1-15)
    advance_amount REAL DEFAULT 0,          -- Сумма аванса
    advance_expenses REAL DEFAULT 0,        -- Расходы (квартира)
    advance_total REAL DEFAULT 0,           -- К выплате (аванс)
    advance_paid BOOLEAN DEFAULT FALSE,     -- Выплачено
    
    -- Зарплата (16-end)
    salary_remainder REAL DEFAULT 0,        -- Остаток за месяц
    salary_expenses REAL DEFAULT 0,         -- Расходы (квартира)
    salary_total REAL DEFAULT 0,           -- К выплате ЗП
    salary_paid BOOLEAN DEFAULT FALSE,     -- Выплачено
    salary_comment TEXT DEFAULT '',        -- Комментарий
    
    -- Служебные поля
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
    
    FOREIGN KEY(payroll_report_id) REFERENCES payroll_reports(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES Users(id)
);

-- Удаляем старую таблицу и переименовываем новую
DROP TABLE IF EXISTS payroll_entries;
ALTER TABLE payroll_entries_new RENAME TO payroll_entries;

-- 5. СОЗДАНИЕ ИНДЕКСОВ ДЛЯ НОВЫХ ТАБЛИЦ
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_payroll_reports_establishment_date ON payroll_reports(establishment_id, year, month);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_report_v2 ON payroll_entries(payroll_report_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_user_v2 ON payroll_entries(user_id);

-- 6. СОЗДАНИЕ ТРИГГЕРОВ ДЛЯ АВТОМАТИЧЕСКОГО ОБНОВЛЕНИЯ
-- ============================================================================
CREATE TRIGGER IF NOT EXISTS update_payroll_reports_timestamp_v2 
AFTER UPDATE ON payroll_reports
FOR EACH ROW 
BEGIN
    UPDATE payroll_reports 
    SET updated_at = datetime('now', 'localtime')
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_payroll_entries_timestamp_v2 
AFTER UPDATE ON payroll_entries
FOR EACH ROW 
BEGIN
    UPDATE payroll_entries 
    SET updated_at = datetime('now', 'localtime')
    WHERE id = NEW.id;
END;

-- 7. БАЗОВЫЕ ДАННЫЕ ДЛЯ WORK_PLANS (ПРИМЕР)
-- ============================================================================
-- Добавляем планы на текущий месяц для всех ролей (можно изменить)
INSERT OR IGNORE INTO work_plans (role, year, month, planned_hours) VALUES
-- Июнь 2025 (пример)
('кальянщик', 2025, 6, 160),
('старший кальянщик', 2025, 6, 180),
('администратор', 2025, 6, 170),
('уборщик', 2025, 6, 160),
('студент', 2025, 6, 120),
('бармен/зал', 2025, 6, 160),

-- Июль 2025 (пример)
('кальянщик', 2025, 7, 160),
('старший кальянщик', 2025, 7, 180),
('администратор', 2025, 7, 170),
('уборщик', 2025, 7, 160),
('студент', 2025, 7, 120),
('бармен/зал', 2025, 7, 160);

-- 8. ОБНОВЛЕНИЕ ТАРИФОВ С ЧАСОВЫМИ СТАВКАМИ (ПРИМЕР)
-- ============================================================================
-- Добавляем часовые ставки к существующим тарифам
UPDATE rates SET hourly_rate_tl = 80 WHERE role = 'кальянщик';
UPDATE rates SET hourly_rate_tl = 90 WHERE role = 'старший кальянщик';
UPDATE rates SET hourly_rate_tl = 120 WHERE role = 'администратор';
UPDATE rates SET hourly_rate_tl = 70 WHERE role = 'уборщик';
UPDATE rates SET hourly_rate_tl = 60 WHERE role = 'студент';
UPDATE rates SET hourly_rate_tl = 75 WHERE role = 'бармен/зал';

-- 9. ОЧИСТКА СТАРЫХ ДАННЫХ АУДИТА (ОПЦИОНАЛЬНО)
-- ============================================================================
-- Очищаем аудит старых записей, которые больше не существуют
DELETE FROM payroll_audit_log WHERE payroll_entry_id NOT IN (SELECT id FROM payroll_entries);

-- 10. АНАЛИЗ ТАБЛИЦ ДЛЯ ОПТИМИЗАЦИИ
-- ============================================================================
ANALYZE work_plans;
ANALYZE payroll_reports;
ANALYZE payroll_entries;
ANALYZE rates;

-- ============================================================================
-- ПРОВЕРКА РЕЗУЛЬТАТОВ МИГРАЦИИ
-- ============================================================================

-- Проверяем структуру новых таблиц
SELECT 'work_plans structure:' as info;
PRAGMA table_info(work_plans);

SELECT 'payroll_reports structure:' as info;
PRAGMA table_info(payroll_reports);

SELECT 'payroll_entries structure:' as info;
PRAGMA table_info(payroll_entries);

SELECT 'rates with hourly_rate_tl:' as info;
PRAGMA table_info(rates);

-- Проверяем индексы
SELECT 'Indexes:' as info;
SELECT name, tbl_name FROM sqlite_master WHERE type = 'index' AND name LIKE '%payroll%' OR name LIKE '%work_plans%';

-- Проверяем данные
SELECT 'Work plans count:' as info, COUNT(*) as count FROM work_plans;
SELECT 'Payroll reports count:' as info, COUNT(*) as count FROM payroll_reports;
SELECT 'Payroll entries count:' as info, COUNT(*) as count FROM payroll_entries;

PRAGMA integrity_check;