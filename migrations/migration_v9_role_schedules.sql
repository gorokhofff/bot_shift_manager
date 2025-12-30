CREATE TABLE IF NOT EXISTS LocationRoleSettings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    location TEXT NOT NULL,
    role TEXT NOT NULL,
    default_start_time TEXT DEFAULT '12:00',
    default_end_time TEXT DEFAULT '00:00',
    UNIQUE(location, role)
);