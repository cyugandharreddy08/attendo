export const CREATE_SUBJECTS = `
  CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#7C3AED',
    target_percent INTEGER NOT NULL DEFAULT 75,
    subject_type TEXT NOT NULL DEFAULT 'theory',
    is_frozen INTEGER NOT NULL DEFAULT 0,
    past_attended INTEGER NOT NULL DEFAULT 0,
    past_total INTEGER NOT NULL DEFAULT 0,
    credits INTEGER NOT NULL DEFAULT 1
  );
`;

export const CREATE_TIMETABLE = `
  CREATE TABLE IF NOT EXISTS timetable (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL,
    day_of_week TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    room TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
  );
`;

export const CREATE_LECTURE_INSTANCES = `
  CREATE TABLE IF NOT EXISTS lecture_instances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    day_of_week TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT,
    marked_at TEXT,
    is_override INTEGER NOT NULL DEFAULT 0,
    original_timetable_id INTEGER,
    room TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
  );
`;

export const CREATE_OVERRIDES = `
  CREATE TABLE IF NOT EXISTS overrides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timetable_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    new_start_time TEXT,
    new_day TEXT,
    reason TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (timetable_id) REFERENCES timetable(id) ON DELETE CASCADE
  );
`;

export const CREATE_EDIT_HISTORY = `
  CREATE TABLE IF NOT EXISTS edit_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lecture_instance_id INTEGER NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    edited_at TEXT NOT NULL,
    FOREIGN KEY (lecture_instance_id) REFERENCES lecture_instances(id) ON DELETE CASCADE
  );
`;

export const CREATE_TODOS = `
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subject_id INTEGER,
    due_date TEXT NOT NULL,
    due_time TEXT,
    priority TEXT NOT NULL DEFAULT 'medium',
    is_completed INTEGER NOT NULL DEFAULT 0,
    alarm_minutes_before INTEGER NOT NULL DEFAULT 15,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE SET NULL
  );
`;

export const CREATE_LOCAL_BUGS = `
  CREATE TABLE IF NOT EXISTS local_bugs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    severity TEXT NOT NULL DEFAULT 'low',
    steps_to_reproduce TEXT,
    image_uri TEXT,
    created_at TEXT NOT NULL,
    is_synced INTEGER NOT NULL DEFAULT 0
  );
`;

export const CREATE_SETTINGS = `
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`;

export const ALL_TABLES = [
  CREATE_SUBJECTS,
  CREATE_TIMETABLE,
  CREATE_LECTURE_INSTANCES,
  CREATE_OVERRIDES,
  CREATE_EDIT_HISTORY,
  CREATE_TODOS,
  CREATE_LOCAL_BUGS,
  CREATE_SETTINGS,
];
