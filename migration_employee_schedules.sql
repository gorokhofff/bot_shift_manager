-- Создать файл: migration_employee_schedules.sql
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

-- Индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_employee_schedules_date 
ON employee_schedules(user_id, year, month, day);

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER IF NOT EXISTS update_employee_schedules_timestamp 
AFTER UPDATE ON employee_schedules
FOR EACH ROW 
BEGIN
    UPDATE employee_schedules 
    SET updated_at = datetime('now', 'localtime')
    WHERE id = NEW.id;
END;