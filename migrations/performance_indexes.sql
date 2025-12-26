-- КРИТИЧЕСКИ ВАЖНЫЕ ИНДЕКСЫ ДЛЯ УСКОРЕНИЯ РАБОТЫ ФОТ
-- Выполнить этот скрипт в базе данных для мгновенного ускорения

-- Индексы для таблицы Shifts (самые важные)
CREATE INDEX IF NOT EXISTS idx_shifts_user_date ON Shifts(user_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_location_date ON Shifts(location, shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_user_location ON Shifts(user_id, location);

-- Индексы для таблицы Reports
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON Reports(created_at);
CREATE INDEX IF NOT EXISTS idx_reports_shift_id ON Reports(shift_id);
CREATE INDEX IF NOT EXISTS idx_reports_shift_created ON Reports(shift_id, created_at);

-- Индексы для таблицы rates (тарифы)
CREATE INDEX IF NOT EXISTS idx_rates_role_date ON rates(role, effective_date DESC);
CREATE INDEX IF NOT EXISTS idx_rates_role_period ON rates(role, period_type, effective_date DESC);

-- Индексы для ФОТ таблиц
CREATE INDEX IF NOT EXISTS idx_payroll_entries_user ON payroll_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_payroll_entries_report ON payroll_entries(payroll_report_id);
CREATE INDEX IF NOT EXISTS idx_payroll_reports_period ON payroll_reports(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_payroll_reports_establishment ON payroll_reports(establishment_id, period_start);

-- Индексы для пользователей
CREATE INDEX IF NOT EXISTS idx_users_role ON Users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON Users(status);

-- Составные индексы для сложных запросов
CREATE INDEX IF NOT EXISTS idx_shifts_complex ON Shifts(user_id, location, shift_date, duration_hours);
CREATE INDEX IF NOT EXISTS idx_reports_complex ON Reports(shift_id, created_at) WHERE report_text IS NOT NULL;

-- Настройки производительности для SQLite
PRAGMA journal_mode=WAL;        -- Включаем WAL режим для лучшей производительности
PRAGMA synchronous=NORMAL;      -- Быстрая синхронизация
PRAGMA cache_size=10000;        -- Увеличиваем кеш
PRAGMA temp_store=MEMORY;       -- Временные таблицы в памяти
PRAGMA mmap_size=268435456;     -- Используем memory-mapped I/O (256MB)

-- Анализируем таблицы для оптимизации планов запросов
ANALYZE Shifts;
ANALYZE Reports; 
ANALYZE Users;
ANALYZE rates;
ANALYZE payroll_reports;
ANALYZE payroll_entries;

-- Проверка созданных индексов
SELECT 
    name as index_name,
    tbl_name as table_name,
    sql
FROM sqlite_master 
WHERE type = 'index' 
    AND name LIKE 'idx_%'
ORDER BY tbl_name, name;