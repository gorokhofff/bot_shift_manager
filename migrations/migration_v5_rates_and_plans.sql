-- Таблица тарифов (если её нет)
CREATE TABLE IF NOT EXISTS rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL,
    amount REAL NOT NULL,
    period_type TEXT CHECK(period_type IN ('hourly', 'daily', 'monthly', 'per_item', 'percent')) DEFAULT 'monthly',
    effective_date TEXT DEFAULT (datetime('now', 'localtime')),
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    UNIQUE(role, period_type)
);

-- Заполним базовыми тарифами, если пусто
INSERT OR IGNORE INTO rates (role, amount, period_type) VALUES 
('кальянщик', 15.0, 'per_item'),
('администратор', 17000.0, 'monthly'),
('уборщик', 12000.0, 'monthly');

-- Убеждаемся, что таблица графиков создана (для простого планировщика)
CREATE TABLE IF NOT EXISTS employee_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    day INTEGER NOT NULL,
    is_workday BOOLEAN DEFAULT 1, -- 1 = Рабочий день (по плану), 0 = Выходной
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    UNIQUE(user_id, year, month, day),
    FOREIGN KEY(user_id) REFERENCES Users(id)
);