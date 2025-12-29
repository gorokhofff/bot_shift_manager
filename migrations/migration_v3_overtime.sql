-- 1. Создаем таблицу графиков (из вашего файла)
CREATE TABLE IF NOT EXISTS employee_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    day INTEGER NOT NULL,
    is_workday BOOLEAN DEFAULT 1,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
    UNIQUE(user_id, year, month, day),
    FOREIGN KEY(user_id) REFERENCES Users(id)
);

CREATE INDEX IF NOT EXISTS idx_employee_schedules_date ON employee_schedules(user_id, year, month, day);

-- 2. Добавляем поля для учета переработок в таблицу расчета ЗП
ALTER TABLE payroll_entries ADD COLUMN missed_days_off INTEGER DEFAULT 0; -- Кол-во рабочих дней в выходной
ALTER TABLE payroll_entries ADD COLUMN overtime_pay REAL DEFAULT 0;       -- Доплата за эти дни
ALTER TABLE rates ADD COLUMN day_off_rate REAL DEFAULT 0;                -- Ставка компенсации за выходной (если фиксированная)