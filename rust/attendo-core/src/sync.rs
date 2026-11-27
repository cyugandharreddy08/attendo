use crate::db;
use crate::error::{AttendoError, AttendoResult};
use crate::models::{CloudBackupPayload, SyncResult};
use chrono::Local;
use rand::Rng;
use rusqlite::{params, Connection};

pub const SUPABASE_URL: &str = "https://wmwiekdihtwutupvnlxo.supabase.co";
pub const SUPABASE_ANON_KEY: &str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indtd2lla2RpaHR3dXR1cHZubHhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1NDcxNDcsImV4cCI6MjEwMjEyMzE0N30.SBtZ4Tt12JIcFmeS7_0_-brRFOSUAux2H0ppBIxGfEg";

const SETTING_ACCOUNT_SYNC_KEY: &str = "account_sync_key";
const SETTING_LAST_SYNC_TIME: &str = "account_last_sync_timestamp";
const APP_VERSION: &str = "9.0.0";
const BACKUP_SCHEMA_VERSION: i32 = 2;

/// Generates a high-entropy 12-char code: ATND-XXXX-XXXX (excluding 0, 1, I, O)
pub fn generate_security_code() -> String {
    const CHARS: &[u8] = b"23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let mut rng = rand::thread_rng();
    let mut part1 = String::with_capacity(4);
    let mut part2 = String::with_capacity(4);
    for _ in 0..4 {
        part1.push(CHARS[rng.gen_range(0..CHARS.len())] as char);
        part2.push(CHARS[rng.gen_range(0..CHARS.len())] as char);
    }
    format!("ATND-{}-{}", part1, part2)
}

pub fn normalize_security_code(input: &str) -> String {
    let trimmed = input.trim().to_uppercase();
    if trimmed.is_empty() {
        return String::new();
    }
    let mut cleaned: String = trimmed.chars().filter(|c| c.is_ascii_alphanumeric()).collect();
    if cleaned.starts_with("ATND") {
        cleaned = cleaned[4..].to_string();
    }
    if cleaned.len() >= 8 {
        format!("ATND-{}-{}", &cleaned[0..4], &cleaned[4..8])
    } else {
        trimmed
    }
}

/// Deterministic FNV-1a 32-bit checksum matching v8.1.4 CloudBackupService.
pub fn compute_payload_checksum(
    subjects_len: usize,
    timetable_len: usize,
    instances_len: usize,
    overrides_len: usize,
    todos_len: usize,
) -> String {
    let content = format!(
        "{}:{}:{}:{}:{}",
        subjects_len, timetable_len, instances_len, overrides_len, todos_len
    );
    let mut hash: u32 = 0x811c9dc5;
    for b in content.bytes() {
        hash ^= b as u32;
        hash = hash.wrapping_mul(0x01000193);
    }
    format!("{:08x}", hash)
}

pub fn get_or_generate_sync_key(conn: &Connection) -> AttendoResult<String> {
    if let Some(existing) = db::get_setting(conn, SETTING_ACCOUNT_SYNC_KEY)? {
        let trimmed = existing.trim().to_uppercase();
        if !trimmed.is_empty() {
            return Ok(trimmed);
        }
    }
    let new_key = generate_security_code();
    db::set_setting(conn, SETTING_ACCOUNT_SYNC_KEY, &new_key)?;
    Ok(new_key)
}

pub fn set_sync_key(conn: &Connection, key: &str) -> AttendoResult<String> {
    let normalized = normalize_security_code(key);
    db::set_setting(conn, SETTING_ACCOUNT_SYNC_KEY, &normalized)?;
    Ok(normalized)
}

pub fn get_last_sync_time(conn: &Connection) -> AttendoResult<Option<String>> {
    db::get_setting(conn, SETTING_LAST_SYNC_TIME)
}

pub fn export_user_data(conn: &Connection) -> AttendoResult<CloudBackupPayload> {
    let subjects = db::get_all_subjects(conn)?;
    let timetable = db::get_all_timetable_entries(conn)?;
    let instances = db::get_all_instances(conn)?;
    let overrides = db::get_all_overrides(conn)?;
    let todos = db::get_all_todos(conn)?;

    let checksum = compute_payload_checksum(
        subjects.len(),
        timetable.len(),
        instances.len(),
        overrides.len(),
        todos.len(),
    );

    Ok(CloudBackupPayload {
        schema_version: BACKUP_SCHEMA_VERSION,
        app_version: APP_VERSION.to_string(),
        exported_at: Local::now().to_rfc3339(),
        checksum,
        subjects,
        timetable,
        instances,
        overrides,
        todos,
    })
}

pub fn apply_restored_payload(
    conn: &mut Connection,
    payload: &CloudBackupPayload,
    mode: &str,
) -> AttendoResult<(usize, usize)> {
    let tx = conn.transaction()?;

    if mode == "replace" {
        tx.execute_batch(
            "DELETE FROM edit_history;
             DELETE FROM overrides;
             DELETE FROM lecture_instances;
             DELETE FROM timetable;
             DELETE FROM todos;
             DELETE FROM subjects;",
        )?;

        for s in &payload.subjects {
            tx.execute(
                "INSERT OR REPLACE INTO subjects (id, name, color, target_percent, subject_type, is_frozen, past_attended, past_total, credits)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                params![
                    s.id, s.name, s.color, s.target_percent, s.subject_type,
                    s.is_frozen, s.past_attended, s.past_total, s.credits
                ],
            )?;
        }

        for t in &payload.timetable {
            tx.execute(
                "INSERT OR REPLACE INTO timetable (id, subject_id, day_of_week, start_time, end_time, room)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![t.id, t.subject_id, t.day_of_week, t.start_time, t.end_time, t.room],
            )?;
        }

        for i in &payload.instances {
            tx.execute(
                "INSERT OR REPLACE INTO lecture_instances (id, subject_id, date, day_of_week, start_time, end_time, status, marked_at, is_override, original_timetable_id, room, notes)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                params![
                    i.id, i.subject_id, i.date, i.day_of_week, i.start_time, i.end_time,
                    i.status, i.marked_at, i.is_override, i.original_timetable_id, i.room, i.notes
                ],
            )?;
        }

        for o in &payload.overrides {
            tx.execute(
                "INSERT OR REPLACE INTO overrides (id, timetable_id, date, new_start_time, new_day, reason)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![o.id, o.timetable_id, o.date, o.new_start_time, o.new_day, o.reason],
            )?;
        }

        for td in &payload.todos {
            tx.execute(
                "INSERT OR REPLACE INTO todos (id, title, subject_id, due_date, due_time, priority, is_completed, alarm_minutes_before, notes, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    td.id, td.title, td.subject_id, td.due_date, td.due_time, td.priority,
                    td.is_completed, td.alarm_minutes_before, td.notes, td.created_at
                ],
            )?;
        }
    } else {
        // Merge mode: match subjects by name (case-insensitive) and remap IDs cleanly
        use std::collections::HashMap;
        let mut subject_id_map: HashMap<i64, i64> = HashMap::new();

        for s in &payload.subjects {
            let existing_id: Option<i64> = tx
                .query_row(
                    "SELECT id FROM subjects WHERE LOWER(name) = LOWER(?1) LIMIT 1",
                    params![s.name],
                    |row| row.get(0),
                )
                .ok();

            let target_id = if let Some(eid) = existing_id {
                eid
            } else {
                tx.execute(
                    "INSERT INTO subjects (name, color, target_percent, subject_type, is_frozen, past_attended, past_total, credits)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    params![
                        s.name, s.color, s.target_percent, s.subject_type,
                        s.is_frozen, s.past_attended, s.past_total, s.credits
                    ],
                )?;
                tx.last_insert_rowid()
            };
            subject_id_map.insert(s.id, target_id);
        }

        for t in &payload.timetable {
            if let Some(&mapped_subj_id) = subject_id_map.get(&t.subject_id) {
                let exists: Option<i64> = tx
                    .query_row(
                        "SELECT id FROM timetable WHERE subject_id = ?1 AND LOWER(day_of_week) = LOWER(?2) AND start_time = ?3",
                        params![mapped_subj_id, t.day_of_week, t.start_time],
                        |row| row.get(0),
                    )
                    .ok();
                if exists.is_none() {
                    tx.execute(
                        "INSERT INTO timetable (subject_id, day_of_week, start_time, end_time, room)
                         VALUES (?1, ?2, ?3, ?4, ?5)",
                        params![mapped_subj_id, t.day_of_week, t.start_time, t.end_time, t.room],
                    )?;
                }
            }
        }

        for i in &payload.instances {
            if let Some(&mapped_subj_id) = subject_id_map.get(&i.subject_id) {
                let exists: Option<i64> = tx
                    .query_row(
                        "SELECT id FROM lecture_instances WHERE subject_id = ?1 AND date = ?2 AND start_time = ?3",
                        params![mapped_subj_id, i.date, i.start_time],
                        |row| row.get(0),
                    )
                    .ok();
                if exists.is_none() {
                    tx.execute(
                        "INSERT INTO lecture_instances (subject_id, date, day_of_week, start_time, end_time, status, marked_at, is_override, room, notes)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                        params![
                            mapped_subj_id, i.date, i.day_of_week, i.start_time, i.end_time,
                            i.status, i.marked_at, i.is_override, i.room, i.notes
                        ],
                    )?;
                }
            }
        }

        for td in &payload.todos {
            let mapped_subj = td.subject_id.and_then(|sid| subject_id_map.get(&sid).copied());
            let exists: Option<i64> = tx
                .query_row(
                    "SELECT id FROM todos WHERE title = ?1 AND due_date = ?2",
                    params![td.title, td.due_date],
                    |row| row.get(0),
                )
                .ok();
            if exists.is_none() {
                tx.execute(
                    "INSERT INTO todos (title, subject_id, due_date, due_time, priority, is_completed, alarm_minutes_before, notes, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
                    params![
                        td.title, mapped_subj, td.due_date, td.due_time, td.priority,
                        td.is_completed, td.alarm_minutes_before, td.notes, td.created_at
                    ],
                )?;
            }
        }
    }

    tx.commit()?;
    Ok((payload.subjects.len(), payload.instances.len()))
}

pub fn backup_to_cloud(conn: &Connection, explicit_key: Option<&str>) -> AttendoResult<SyncResult> {
    let sync_key = match explicit_key {
        Some(k) if !k.trim().is_empty() => normalize_security_code(k),
        _ => get_or_generate_sync_key(conn)?,
    };

    let data = export_user_data(conn)?;
    let subjects_count = data.subjects.len();
    let classes_count = data.instances.len();
    let now = Local::now().to_rfc3339();

    let record = serde_json::json!({
        "sync_code": sync_key,
        "payload": data,
        "schema_version": data.schema_version,
        "subjects_count": subjects_count,
        "classes_count": classes_count,
        "checksum": data.checksum,
        "updated_at": now,
    });

    let url = format!("{}/rest/v1/account_sync_vaults", SUPABASE_URL);
    let resp = ureq::post(&url)
        .set("apikey", SUPABASE_ANON_KEY)
        .set("Authorization", &format!("Bearer {}", SUPABASE_ANON_KEY))
        .set("Content-Type", "application/json")
        .set("Prefer", "resolution=merge-duplicates,return=minimal")
        .send_json(record)
        .map_err(|e| AttendoError::Network(e.to_string()))?;

    if resp.status() >= 200 && resp.status() < 300 {
        db::set_setting(conn, SETTING_LAST_SYNC_TIME, &now)?;
        Ok(SyncResult {
            success: true,
            sync_key,
            message: format!(
                "Backed up {} subjects & {} classes to cloud vault.",
                subjects_count, classes_count
            ),
            subjects_count,
            classes_count,
        })
    } else {
        Ok(SyncResult {
            success: false,
            sync_key,
            message: format!("Cloud sync returned HTTP {}", resp.status()),
            subjects_count: 0,
            classes_count: 0,
        })
    }
}

pub fn restore_from_cloud(
    conn: &mut Connection,
    raw_code: &str,
    mode: &str,
) -> AttendoResult<SyncResult> {
    let sync_code = normalize_security_code(raw_code);
    if sync_code.len() < 8 {
        return Ok(SyncResult {
            success: false,
            sync_key: String::new(),
            message: "Invalid Security Code. Expected format ATND-XXXX-XXXX.".to_string(),
            subjects_count: 0,
            classes_count: 0,
        });
    }

    let url = format!(
        "{}/rest/v1/account_sync_vaults?sync_code=eq.{}&select=*",
        SUPABASE_URL, sync_code
    );
    let resp = ureq::get(&url)
        .set("apikey", SUPABASE_ANON_KEY)
        .set("Authorization", &format!("Bearer {}", SUPABASE_ANON_KEY))
        .set("Content-Type", "application/json")
        .call()
        .map_err(|e| AttendoError::Network(e.to_string()))?;

    let rows: Vec<serde_json::Value> = resp
        .into_json()
        .map_err(|e| AttendoError::Network(e.to_string()))?;

    let payload_val = rows
        .first()
        .and_then(|r| r.get("payload"))
        .ok_or_else(|| AttendoError::NotFound {
            entity: "backup",
            id: sync_code.clone(),
        })?;

    let payload: CloudBackupPayload = if let Some(s) = payload_val.as_str() {
        serde_json::from_str(s)?
    } else {
        serde_json::from_value(payload_val.clone())?
    };

    let (subjects_count, classes_count) = apply_restored_payload(conn, &payload, mode)?;

    // CRITICAL REQUIREMENT FROM USER:
    // If user merges data, the active key MUST BE THE NEW ONE (current device's active key or freshly generated),
    // NOT the old imported key!
    let final_key = if mode == "replace" {
        set_sync_key(conn, &sync_code)?
    } else {
        let mut active_key = get_or_generate_sync_key(conn)?;
        if active_key.eq_ignore_ascii_case(&sync_code) {
            active_key = generate_security_code();
            db::set_setting(conn, SETTING_ACCOUNT_SYNC_KEY, &active_key)?;
        }
        // Immediately back up merged dataset under the new active key
        let _ = backup_to_cloud(conn, Some(&active_key));
        active_key
    };

    db::set_setting(conn, SETTING_LAST_SYNC_TIME, &Local::now().to_rfc3339())?;

    Ok(SyncResult {
        success: true,
        sync_key: final_key.clone(),
        message: if mode == "merge" {
            format!(
                "Merged {} subjects & {} classes. Active key retained as {}.",
                subjects_count, classes_count, final_key
            )
        } else {
            format!(
                "Restored {} subjects & {} classes from {}.",
                subjects_count, classes_count, sync_code
            )
        },
        subjects_count,
        classes_count,
    })
}
