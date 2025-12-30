CREATE TABLE IF NOT EXISTS LocationSettings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location TEXT NOT NULL,
    default_start_time TEXT DEFAULT '12:00', -- HH:MM
    default_end_time TEXT DEFAULT '00:00',   -- HH:MM
    UNIQUE(location)
);

-- Заполним дефолтными значениями существующие локации
INSERT OR IGNORE INTO LocationSettings (location, default_start_time, default_end_time) VALUES ('Yenibosna', '12:00', '00:00');
INSERT OR IGNORE INTO LocationSettings (location, default_start_time, default_end_time) VALUES ('Göktürk', '13:00', '01:00');