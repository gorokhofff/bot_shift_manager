-- 1. Таблица планов рабочего времени по ролям
CREATE TABLE IF NOT EXISTS role_work_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    planned_hours INTEGER DEFAULT 160,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    UNIQUE(role, year, month)
);

-- 2. Добавляем поля для статусов выплат и комментариев в payroll_entries
-- Используем безопасное добавление (SQLite не падает, если колонка уже есть, в скрипте запуска мы это обработаем)
ALTER TABLE payroll_entries ADD COLUMN advance_paid BOOLEAN DEFAULT 0;
ALTER TABLE payroll_entries ADD COLUMN salary_paid BOOLEAN DEFAULT 0;
ALTER TABLE payroll_entries ADD COLUMN salary_comment TEXT;

-- 3. Добавляем поля для расходов (если их нет, или используем алиасы в коде, но лучше добавить явно)
ALTER TABLE payroll_entries ADD COLUMN advance_expenses REAL DEFAULT 0; -- Расходы вычитаемые из аванса
ALTER TABLE payroll_entries ADD COLUMN salary_expenses REAL DEFAULT 0;  -- Расходы вычитаемые из ЗП
ALTER TABLE payroll_entries ADD COLUMN actual_hours REAL DEFAULT 0;     -- Фактические часы (для фиксации)