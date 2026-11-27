use crate::error::AttendoResult;
use crate::models::{
    EditHistoryRecord, LectureInstance, LocalBug, OverrideRecord, Subject, SubjectInput,
    TimetableEntry, TimetableEntryInput, TodoInput, TodoItem,
};
use chrono::{Datelike, Local, NaiveDate};
use rusqlite::{params, Connection, OptionalExtension};

const SCHEMA_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#8B5CF6',
    target_percent INTEGER NOT NULL DEFAULT 75,
    subject_type TEXT NOT NULL DEFAULT 'theory',
    is_frozen INTEGER NOT NULL DEFAULT 0,
    past_attended INTEGER NOT NULL DEFAULT 0,
    past_total INTEGER NOT NULL DEFAULT 0,
    credits INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS timetable (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subject_id INTEGER NOT NULL,
    day_of_week TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    room TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE
);

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

CREATE TABLE IF NOT EXISTS overrides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timetable_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    new_start_time TEXT,
    new_day TEXT,
    reason TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (timetable_id) REFERENCES timetable(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS edit_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lecture_instance_id INTEGER NOT NULL,
    old_status TEXT,
    new_status TEXT NOT NULL,
    edited_at TEXT NOT NULL,
    FOREIGN KEY (lecture_instance_id) REFERENCES lecture_instances(id) ON DELETE CASCADE
);

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

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_instances_date ON lecture_instances(date);
CREATE INDEX IF NOT EXISTS idx_instances_subj ON lecture_instances(subject_id);
CREATE INDEX IF NOT EXISTS idx_timetable_day ON timetable(day_of_week);
"#;

pub fn open_and_init(db_path: &str) -> AttendoResult<Connection> {
    let conn = if db_path == ":memory:" {
        Connection::open_in_memory()?
    } else {
        Connection::open(db_path)?
    };

    // High-speed SQLite tuning: WAL + 256MB mmap + memory temp store
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA mmap_size = 268435456;
         PRAGMA temp_store = MEMORY;
         PRAGMA cache_size = -16000;
         PRAGMA foreign_keys = ON;",
    )?;

    conn.execute_batch(SCHEMA_SQL)?;

    // Safe deduplication matching legacy tracker75.db
    let _ = conn.execute_batch(
        "DELETE FROM timetable WHERE id NOT IN (
            SELECT MIN(id) FROM timetable GROUP BY subject_id, day_of_week, start_time, end_time
         );
         DELETE FROM lecture_instances WHERE id NOT IN (
            SELECT MIN(id) FROM lecture_instances GROUP BY date, subject_id, start_time
         );",
    );

    Ok(conn)
}

pub fn weekday_name_from_date(date_str: &str) -> String {
    if let Ok(d) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
        match d.weekday() {
            chrono::Weekday::Mon => "Monday",
            chrono::Weekday::Tue => "Tuesday",
            chrono::Weekday::Wed => "Wednesday",
            chrono::Weekday::Thu => "Thursday",
            chrono::Weekday::Fri => "Friday",
            chrono::Weekday::Sat => "Saturday",
            chrono::Weekday::Sun => "Sunday",
        }
        .to_string()
    } else {
        "Monday".to_string()
    }
}

// ==================== SETTINGS ====================

pub fn get_setting(conn: &Connection, key: &str) -> AttendoResult<Option<String>> {
    let val = conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )
        .optional()?;
    Ok(val)
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> AttendoResult<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}

pub fn delete_setting(conn: &Connection, key: &str) -> AttendoResult<()> {
    conn.execute("DELETE FROM settings WHERE key = ?1", params![key])?;
    Ok(())
}

// ==================== SUBJECTS ====================

pub fn get_all_subjects(conn: &Connection) -> AttendoResult<Vec<Subject>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, color, target_percent, subject_type, is_frozen,
                past_attended, past_total, credits
         FROM subjects ORDER BY is_frozen ASC, name ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Subject {
            id: row.get(0)?,
            name: row.get(1)?,
            color: row.get(2)?,
            target_percent: row.get(3)?,
            subject_type: row.get(4)?,
            is_frozen: row.get(5)?,
            past_attended: row.get(6)?,
            past_total: row.get(7)?,
            credits: row.get(8)?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn add_subject(conn: &Connection, input: &SubjectInput) -> AttendoResult<i64> {
    conn.execute(
        "INSERT INTO subjects (name, color, target_percent, subject_type, is_frozen, past_attended, past_total, credits)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            input.name.trim(),
            input.color,
            input.target_percent,
            input.subject_type,
            input.is_frozen,
            input.past_attended,
            input.past_total,
            input.credits.max(1),
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn update_subject(conn: &Connection, id: i64, input: &SubjectInput) -> AttendoResult<()> {
    conn.execute(
        "UPDATE subjects
         SET name = ?1, color = ?2, target_percent = ?3, subject_type = ?4,
             is_frozen = ?5, past_attended = ?6, past_total = ?7, credits = ?8
         WHERE id = ?9",
        params![
            input.name.trim(),
            input.color,
            input.target_percent,
            input.subject_type,
            input.is_frozen,
            input.past_attended,
            input.past_total,
            input.credits.max(1),
            id,
        ],
    )?;
    Ok(())
}

pub fn delete_subject(conn: &Connection, id: i64) -> AttendoResult<()> {
    conn.execute("DELETE FROM subjects WHERE id = ?1", params![id])?;
    Ok(())
}

// ==================== TIMETABLE ====================

pub fn get_all_timetable_entries(conn: &Connection) -> AttendoResult<Vec<TimetableEntry>> {
    let mut stmt = conn.prepare(
        "SELECT t.id, t.subject_id, t.day_of_week, t.start_time, t.end_time, t.room,
                s.name, s.color, s.subject_type
         FROM timetable t
         LEFT JOIN subjects s ON t.subject_id = s.id
         ORDER BY t.day_of_week ASC, t.start_time ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(TimetableEntry {
            id: row.get(0)?,
            subject_id: row.get(1)?,
            day_of_week: row.get(2)?,
            start_time: row.get(3)?,
            end_time: row.get(4)?,
            room: row.get(5)?,
            subject_name: row.get(6)?,
            subject_color: row.get(7)?,
            subject_type: row.get(8)?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn get_timetable_for_day(conn: &Connection, day_of_week: &str) -> AttendoResult<Vec<TimetableEntry>> {
    let mut stmt = conn.prepare(
        "SELECT t.id, t.subject_id, t.day_of_week, t.start_time, t.end_time, t.room,
                s.name, s.color, s.subject_type
         FROM timetable t
         LEFT JOIN subjects s ON t.subject_id = s.id
         WHERE LOWER(t.day_of_week) = LOWER(?1)
         ORDER BY t.start_time ASC",
    )?;
    let rows = stmt.query_map(params![day_of_week], |row| {
        Ok(TimetableEntry {
            id: row.get(0)?,
            subject_id: row.get(1)?,
            day_of_week: row.get(2)?,
            start_time: row.get(3)?,
            end_time: row.get(4)?,
            room: row.get(5)?,
            subject_name: row.get(6)?,
            subject_color: row.get(7)?,
            subject_type: row.get(8)?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn add_timetable_entry(conn: &Connection, input: &TimetableEntryInput) -> AttendoResult<i64> {
    // Avoid exact duplicate slot
    let existing: Option<i64> = conn
        .query_row(
            "SELECT id FROM timetable
             WHERE subject_id = ?1 AND LOWER(day_of_week) = LOWER(?2) AND start_time = ?3 AND end_time = ?4",
            params![input.subject_id, input.day_of_week, input.start_time, input.end_time],
            |row| row.get(0),
        )
        .optional()?;
    if let Some(id) = existing {
        return Ok(id);
    }

    conn.execute(
        "INSERT INTO timetable (subject_id, day_of_week, start_time, end_time, room)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            input.subject_id,
            input.day_of_week,
            input.start_time,
            input.end_time,
            input.room.trim(),
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn delete_timetable_entry(conn: &Connection, id: i64) -> AttendoResult<()> {
    conn.execute("DELETE FROM timetable WHERE id = ?1", params![id])?;
    Ok(())
}

// ==================== LECTURE INSTANCES & SHIFT/UNSHIFT ====================

pub fn ensure_instances_for_date(conn: &Connection, date_str: &str) -> AttendoResult<()> {
    let day_name = weekday_name_from_date(date_str);
    let entries = get_timetable_for_day(conn, &day_name)?;

    for entry in entries {
        let exists: Option<i64> = conn
            .query_row(
                "SELECT id FROM lecture_instances
                 WHERE date = ?1 AND subject_id = ?2 AND start_time = ?3",
                params![date_str, entry.subject_id, entry.start_time],
                |row| row.get(0),
            )
            .optional()?;

        if exists.is_none() {
            conn.execute(
                "INSERT INTO lecture_instances
                 (subject_id, date, day_of_week, start_time, end_time, status, marked_at, is_override, original_timetable_id, room, notes)
                 VALUES (?1, ?2, ?3, ?4, ?5, NULL, NULL, 0, ?6, ?7, '')",
                params![
                    entry.subject_id,
                    date_str,
                    day_name,
                    entry.start_time,
                    entry.end_time,
                    entry.id,
                    entry.room,
                ],
            )?;
        }
    }
    Ok(())
}

pub fn get_instances_for_date(conn: &Connection, date_str: &str) -> AttendoResult<Vec<LectureInstance>> {
    ensure_instances_for_date(conn, date_str)?;
    let mut stmt = conn.prepare(
        "SELECT li.id, li.subject_id, li.date, li.day_of_week, li.start_time, li.end_time,
                li.status, li.marked_at, li.is_override, li.original_timetable_id, li.room, li.notes,
                s.name, s.color, s.subject_type, COALESCE(s.is_frozen, 0)
         FROM lecture_instances li
         LEFT JOIN subjects s ON li.subject_id = s.id
         WHERE li.date = ?1
         ORDER BY li.start_time ASC",
    )?;
    let rows = stmt.query_map(params![date_str], |row| {
        Ok(LectureInstance {
            id: row.get(0)?,
            subject_id: row.get(1)?,
            date: row.get(2)?,
            day_of_week: row.get(3)?,
            start_time: row.get(4)?,
            end_time: row.get(5)?,
            status: row.get(6)?,
            marked_at: row.get(7)?,
            is_override: row.get(8)?,
            original_timetable_id: row.get(9)?,
            room: row.get(10)?,
            notes: row.get(11)?,
            subject_name: row.get(12)?,
            subject_color: row.get(13)?,
            subject_type: row.get(14)?,
            is_frozen: row.get(15)?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn get_all_instances(conn: &Connection) -> AttendoResult<Vec<LectureInstance>> {
    let mut stmt = conn.prepare(
        "SELECT li.id, li.subject_id, li.date, li.day_of_week, li.start_time, li.end_time,
                li.status, li.marked_at, li.is_override, li.original_timetable_id, li.room, li.notes,
                s.name, s.color, s.subject_type, COALESCE(s.is_frozen, 0)
         FROM lecture_instances li
         LEFT JOIN subjects s ON li.subject_id = s.id
         ORDER BY li.date DESC, li.start_time ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(LectureInstance {
            id: row.get(0)?,
            subject_id: row.get(1)?,
            date: row.get(2)?,
            day_of_week: row.get(3)?,
            start_time: row.get(4)?,
            end_time: row.get(5)?,
            status: row.get(6)?,
            marked_at: row.get(7)?,
            is_override: row.get(8)?,
            original_timetable_id: row.get(9)?,
            room: row.get(10)?,
            notes: row.get(11)?,
            subject_name: row.get(12)?,
            subject_color: row.get(13)?,
            subject_type: row.get(14)?,
            is_frozen: row.get(15)?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn update_instance_status(
    conn: &Connection,
    instance_id: i64,
    new_status: Option<&str>,
    notes: Option<&str>,
) -> AttendoResult<()> {
    let old_status: Option<String> = conn
        .query_row(
            "SELECT status FROM lecture_instances WHERE id = ?1",
            params![instance_id],
            |row| row.get(0),
        )
        .optional()?
        .flatten();

    let now = Local::now().to_rfc3339();
    let marked_at = new_status.map(|_| now.clone());

    if let Some(n) = notes {
        conn.execute(
            "UPDATE lecture_instances SET status = ?1, marked_at = ?2, notes = ?3 WHERE id = ?4",
            params![new_status, marked_at, n, instance_id],
        )?;
    } else {
        conn.execute(
            "UPDATE lecture_instances SET status = ?1, marked_at = ?2 WHERE id = ?3",
            params![new_status, marked_at, instance_id],
        )?;
    }

    if let Some(ns) = new_status {
        conn.execute(
            "INSERT INTO edit_history (lecture_instance_id, old_status, new_status, edited_at)
             VALUES (?1, ?2, ?3, ?4)",
            params![instance_id, old_status, ns, now],
        )?;
    }

    Ok(())
}

pub fn mark_entire_day_status(conn: &Connection, date_str: &str, status: &str) -> AttendoResult<usize> {
    ensure_instances_for_date(conn, date_str)?;
    let now = Local::now().to_rfc3339();
    let updated = conn.execute(
        "UPDATE lecture_instances
         SET status = ?1, marked_at = ?2
         WHERE date = ?3 AND (status IS NULL OR status != 'shifted')",
        params![status, now, date_str],
    )?;
    Ok(updated)
}

/// Shifts a lecture instance to a new date & time slot (supports both one-time override and permanent timetable move).
pub fn shift_lecture_instance(
    conn: &Connection,
    instance_id: i64,
    target_date: &str,
    target_start_time: &str,
    target_end_time: &str,
    reason: &str,
    is_permanent: bool,
) -> AttendoResult<i64> {
    let (subject_id, orig_date, orig_tt_id, room): (i64, String, Option<i64>, String) = conn.query_row(
        "SELECT subject_id, date, original_timetable_id, room FROM lecture_instances WHERE id = ?1",
        params![instance_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
    )?;

    let target_day = weekday_name_from_date(target_date);
    let now = Local::now().to_rfc3339();

    // Mark original instance as 'shifted'
    let shift_note = if reason.is_empty() {
        format!("Shifted to {} {}", target_date, target_start_time)
    } else {
        format!("Shifted to {} {} ({})", target_date, target_start_time, reason)
    };

    conn.execute(
        "UPDATE lecture_instances SET status = 'shifted', marked_at = ?1, notes = ?2 WHERE id = ?3",
        params![now, shift_note, instance_id],
    )?;

    // Record override if linked to a timetable entry
    if let Some(tt_id) = orig_tt_id {
        conn.execute(
            "INSERT INTO overrides (timetable_id, date, new_start_time, new_day, reason)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![tt_id, orig_date, target_start_time, target_day, reason],
        )?;
        if is_permanent {
            conn.execute(
                "UPDATE timetable SET day_of_week = ?1, start_time = ?2, end_time = ?3 WHERE id = ?4",
                params![target_day, target_start_time, target_end_time, tt_id],
            )?;
        }
    }

    // Create destination override instance
    let dest_note = format!("Shifted from {}", orig_date);
    conn.execute(
        "INSERT INTO lecture_instances
         (subject_id, date, day_of_week, start_time, end_time, status, marked_at, is_override, original_timetable_id, room, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, NULL, NULL, 1, ?6, ?7, ?8)",
        params![
            subject_id,
            target_date,
            target_day,
            target_start_time,
            target_end_time,
            orig_tt_id,
            room,
            dest_note,
        ],
    )?;

    Ok(conn.last_insert_rowid())
}

/// Bulletproof unshift: reverts a shifted class cleanly whether triggered from the original 'shifted' slot or the override destination slot.
pub fn unshift_lecture_instance(conn: &Connection, instance_id: i64) -> AttendoResult<()> {
    let (subject_id, date, is_override, orig_tt_id, status): (i64, String, i32, Option<i64>, Option<String>) = conn.query_row(
        "SELECT subject_id, date, is_override, original_timetable_id, status FROM lecture_instances WHERE id = ?1",
        params![instance_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
    )?;

    if is_override == 1 {
        // User tapped the destination shifted copy -> delete it and revert the original 'shifted' slot
        conn.execute("DELETE FROM lecture_instances WHERE id = ?1", params![instance_id])?;
        if let Some(tt_id) = orig_tt_id {
            conn.execute(
                "UPDATE lecture_instances SET status = NULL, marked_at = NULL, notes = ''
                 WHERE original_timetable_id = ?1 AND status = 'shifted'",
                params![tt_id],
            )?;
            conn.execute("DELETE FROM overrides WHERE timetable_id = ?1", params![tt_id])?;
        } else {
            conn.execute(
                "UPDATE lecture_instances SET status = NULL, marked_at = NULL, notes = ''
                 WHERE subject_id = ?1 AND status = 'shifted' AND is_override = 0",
                params![subject_id],
            )?;
        }
    } else if status.as_deref() == Some("shifted") {
        // User tapped the original 'shifted' slot -> revert it and remove the override copy
        conn.execute(
            "UPDATE lecture_instances SET status = NULL, marked_at = NULL, notes = '' WHERE id = ?1",
            params![instance_id],
        )?;
        if let Some(tt_id) = orig_tt_id {
            conn.execute(
                "DELETE FROM lecture_instances WHERE original_timetable_id = ?1 AND is_override = 1",
                params![tt_id],
            )?;
            conn.execute(
                "DELETE FROM overrides WHERE timetable_id = ?1 AND date = ?2",
                params![tt_id, date],
            )?;
        } else {
            conn.execute(
                "DELETE FROM lecture_instances WHERE subject_id = ?1 AND is_override = 1",
                params![subject_id],
            )?;
        }
    }

    Ok(())
}

// ==================== TODOS ====================

pub fn get_all_todos(conn: &Connection) -> AttendoResult<Vec<TodoItem>> {
    let mut stmt = conn.prepare(
        "SELECT td.id, td.title, td.subject_id, td.due_date, td.due_time, td.priority,
                td.is_completed, td.alarm_minutes_before, td.notes, td.created_at,
                s.name, s.color
         FROM todos td
         LEFT JOIN subjects s ON td.subject_id = s.id
         ORDER BY td.is_completed ASC, td.due_date ASC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(TodoItem {
            id: row.get(0)?,
            title: row.get(1)?,
            subject_id: row.get(2)?,
            due_date: row.get(3)?,
            due_time: row.get(4)?,
            priority: row.get(5)?,
            is_completed: row.get(6)?,
            alarm_minutes_before: row.get(7)?,
            notes: row.get(8)?,
            created_at: row.get(9)?,
            subject_name: row.get(10)?,
            subject_color: row.get(11)?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn add_todo(conn: &Connection, input: &TodoInput) -> AttendoResult<i64> {
    let now = Local::now().to_rfc3339();
    conn.execute(
        "INSERT INTO todos (title, subject_id, due_date, due_time, priority, is_completed, alarm_minutes_before, notes, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, ?7, ?8)",
        params![
            input.title.trim(),
            input.subject_id,
            input.due_date,
            input.due_time,
            input.priority,
            input.alarm_minutes_before,
            input.notes,
            now,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub fn toggle_todo(conn: &Connection, id: i64) -> AttendoResult<()> {
    conn.execute(
        "UPDATE todos SET is_completed = CASE WHEN is_completed = 1 THEN 0 ELSE 1 END WHERE id = ?1",
        params![id],
    )?;
    Ok(())
}

pub fn delete_todo(conn: &Connection, id: i64) -> AttendoResult<()> {
    conn.execute("DELETE FROM todos WHERE id = ?1", params![id])?;
    Ok(())
}

// ==================== OVERRIDES & EDIT HISTORY & BUGS ====================

pub fn get_all_overrides(conn: &Connection) -> AttendoResult<Vec<OverrideRecord>> {
    let mut stmt = conn.prepare("SELECT id, timetable_id, date, new_start_time, new_day, reason FROM overrides")?;
    let rows = stmt.query_map([], |row| {
        Ok(OverrideRecord {
            id: row.get(0)?,
            timetable_id: row.get(1)?,
            date: row.get(2)?,
            new_start_time: row.get(3)?,
            new_day: row.get(4)?,
            reason: row.get(5)?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn get_edit_history(conn: &Connection, instance_id: i64) -> AttendoResult<Vec<EditHistoryRecord>> {
    let mut stmt = conn.prepare(
        "SELECT id, lecture_instance_id, old_status, new_status, edited_at
         FROM edit_history WHERE lecture_instance_id = ?1 ORDER BY id DESC",
    )?;
    let rows = stmt.query_map(params![instance_id], |row| {
        Ok(EditHistoryRecord {
            id: row.get(0)?,
            lecture_instance_id: row.get(1)?,
            old_status: row.get(2)?,
            new_status: row.get(3)?,
            edited_at: row.get(4)?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn get_local_bugs(conn: &Connection) -> AttendoResult<Vec<LocalBug>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, description, category, severity, steps_to_reproduce, image_uri, created_at, is_synced
         FROM local_bugs ORDER BY id DESC",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(LocalBug {
            id: row.get(0)?,
            title: row.get(1)?,
            description: row.get(2)?,
            category: row.get(3)?,
            severity: row.get(4)?,
            steps_to_reproduce: row.get(5)?,
            image_uri: row.get(6)?,
            created_at: row.get(7)?,
            is_synced: row.get(8)?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn insert_local_bug(
    conn: &Connection,
    title: &str,
    description: &str,
    category: &str,
    severity: &str,
    steps: Option<&str>,
    is_synced: i32,
) -> AttendoResult<i64> {
    let now = Local::now().to_rfc3339();
    conn.execute(
        "INSERT INTO local_bugs (title, description, category, severity, steps_to_reproduce, created_at, is_synced)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![title, description, category, severity, steps, now, is_synced],
    )?;
    Ok(conn.last_insert_rowid())
}
