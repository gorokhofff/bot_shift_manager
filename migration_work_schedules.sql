-- Создание таблицы расписаний для заведений
CREATE TABLE IF NOT EXISTS work_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    establishment_name TEXT NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    day INTEGER NOT NULL,
    is_workday BOOLEAN DEFAULT 1,
    work_hours_start TEXT DEFAULT '10:00',
    work_hours_end TEXT DEFAULT '22:00',
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
    UNIQUE(establishment_name, year, month, day)
);

-- Индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_work_schedules_date 
ON work_schedules(establishment_name, year, month, day);

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER IF NOT EXISTS update_work_schedules_timestamp 
AFTER UPDATE ON work_schedules
FOR EACH ROW 
BEGIN
    UPDATE work_schedules 
    SET updated_at = datetime('now', 'localtime')
    WHERE id = NEW.id;
END;

-- Заполнение стандартными значениями для Yenibosna (15:00-02:00)
INSERT OR IGNORE INTO work_schedules (establishment_name, year, month, day, is_workday, work_hours_start, work_hours_end)
SELECT 'Yenibosna', 2025, 1, day, 
    CASE WHEN strftime('%w', '2025-01-' || printf('%02d', day)) IN ('0', '6') 
         THEN 0 ELSE 1 END,
    '15:00', '02:00'
FROM (
    SELECT 1 as day UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION 
    SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION 
    SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15 UNION 
    SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION SELECT 20 UNION 
    SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24 UNION SELECT 25 UNION 
    SELECT 26 UNION SELECT 27 UNION SELECT 28 UNION SELECT 29 UNION SELECT 30 UNION SELECT 31
);

-- Заполнение стандартными значениями для Göktürk (16:00-02:00)
INSERT OR IGNORE INTO work_schedules (establishment_name, year, month, day, is_workday, work_hours_start, work_hours_end)
SELECT 'Göktürk', 2025, 1, day, 
    CASE WHEN strftime('%w', '2025-01-' || printf('%02d', day)) IN ('0', '6') 
         THEN 0 ELSE 1 END,
    '16:00', '02:00'
FROM (
    SELECT 1 as day UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION 
    SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION 
    SELECT 11 UNION SELECT 12 UNION SELECT 13 UNION SELECT 14 UNION SELECT 15 UNION 
    SELECT 16 UNION SELECT 17 UNION SELECT 18 UNION SELECT 19 UNION SELECT 20 UNION 
    SELECT 21 UNION SELECT 22 UNION SELECT 23 UNION SELECT 24 UNION SELECT 25 UNION 
    SELECT 26 UNION SELECT 27 UNION SELECT 28 UNION SELECT 29 UNION SELECT 30 UNION SELECT 31
);