pub mod ai_agent;
pub mod attendance_engine;
pub mod attendo_ai;
pub mod cloud_services;
pub mod db;
pub mod delta_patch;
pub mod error;
pub mod jni_bridge;
pub mod models;
pub mod sync;

use crate::error::{AttendoError, AttendoResult};
use crate::models::{
    ChatMessage, StudentProfile, SubjectInput, TimetableEntryInput, TodoInput,
};
use rusqlite::Connection;
use serde_json::{json, Value};
use std::sync::{Mutex, OnceLock};

static ENGINE: OnceLock<Mutex<Connection>> = OnceLock::new();

pub fn init_engine(db_path: &str) -> AttendoResult<()> {
    if ENGINE.get().is_some() {
        return Ok(());
    }
    let conn = db::open_and_init(db_path)?;
    let _ = ENGINE.set(Mutex::new(conn));
    Ok(())
}

fn with_conn<F, T>(f: F) -> AttendoResult<T>
where
    F: FnOnce(&mut Connection) -> AttendoResult<T>,
{
    let lock = ENGINE.get().ok_or(AttendoError::NotInitialized)?;
    let mut guard = lock
        .lock()
        .map_err(|_| AttendoError::InvalidInput("DB mutex poisoned".into()))?;
    f(&mut guard)
}

pub fn dispatch_rpc(method: &str, payload_json: &str) -> String {
    let args: Value = serde_json::from_str(payload_json).unwrap_or_else(|_| json!({}));
    match dispatch_inner(method, &args) {
        Ok(data) => json!({ "ok": true, "data": data }).to_string(),
        Err(e) => json!({ "ok": false, "error": e.to_string() }).to_string(),
    }
}

fn dispatch_inner(method: &str, args: &Value) -> AttendoResult<Value> {
    match method {
        // ---- DASHBOARD / ANALYTICS ----
        "get_dashboard_snapshot" => with_conn(|conn| {
            let date = args
                .get("date")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| chrono::Local::now().format("%Y-%m-%d").to_string());
            let target = db::get_setting(conn, "global_target_percent")?
                .and_then(|s| s.parse::<i32>().ok())
                .unwrap_or(75);

            let subjects = db::get_all_subjects(conn)?;
            let instances = db::get_all_instances(conn)?;
            let day_classes = db::get_instances_for_date(conn, &date)?;
            let report = attendance_engine::compute_split_report(&subjects, &instances, target);
            let subject_metrics: Vec<_> = subjects
                .iter()
                .map(|s| attendance_engine::compute_subject_metrics(s, &instances))
                .collect();
            let heatmap = attendance_engine::compute_heatmap_and_streaks(
                &subjects,
                &instances,
                report.overall.percent,
            );
            let todos = db::get_all_todos(conn)?;
            let sync_key = sync::get_or_generate_sync_key(conn)?;
            let last_sync = sync::get_last_sync_time(conn)?;

            Ok(json!({
                "date": date,
                "report": report,
                "dayClasses": day_classes,
                "subjects": subject_metrics,
                "heatmap": heatmap,
                "todos": todos,
                "syncKey": sync_key,
                "lastSync": last_sync,
            }))
        }),

        // ---- SUBJECTS ----
        "get_subjects" => with_conn(|conn| {
            let subjects = db::get_all_subjects(conn)?;
            let instances = db::get_all_instances(conn)?;
            let out: Vec<_> = subjects
                .iter()
                .map(|s| attendance_engine::compute_subject_metrics(s, &instances))
                .collect();
            Ok(serde_json::to_value(out)?)
        }),
        "add_subject" => with_conn(|conn| {
            let input: SubjectInput = serde_json::from_value(args.clone())?;
            let id = db::add_subject(conn, &input)?;
            Ok(json!({ "id": id }))
        }),
        "update_subject" => with_conn(|conn| {
            let id = args.get("id").and_then(|v| v.as_i64()).ok_or_else(|| AttendoError::InvalidInput("missing id".into()))?;
            let input: SubjectInput = serde_json::from_value(args.clone())?;
            db::update_subject(conn, id, &input)?;
            Ok(json!({ "updated": true }))
        }),
        "delete_subject" => with_conn(|conn| {
            let id = args.get("id").and_then(|v| v.as_i64()).ok_or_else(|| AttendoError::InvalidInput("missing id".into()))?;
            db::delete_subject(conn, id)?;
            Ok(json!({ "deleted": true }))
        }),

        // ---- TIMETABLE ----
        "get_timetable" => with_conn(|conn| {
            let list = db::get_all_timetable_entries(conn)?;
            Ok(serde_json::to_value(list)?)
        }),
        "add_timetable_entry" => with_conn(|conn| {
            let input: TimetableEntryInput = serde_json::from_value(args.clone())?;
            let id = db::add_timetable_entry(conn, &input)?;
            Ok(json!({ "id": id }))
        }),
        "delete_timetable_entry" => with_conn(|conn| {
            let id = args.get("id").and_then(|v| v.as_i64()).ok_or_else(|| AttendoError::InvalidInput("missing id".into()))?;
            db::delete_timetable_entry(conn, id)?;
            Ok(json!({ "deleted": true }))
        }),

        // ---- LECTURE INSTANCES & SHIFT/UNSHIFT ----
        "get_day_classes" => with_conn(|conn| {
            let date = args.get("date").and_then(|v| v.as_str()).ok_or_else(|| AttendoError::InvalidInput("missing date".into()))?;
            let list = db::get_instances_for_date(conn, date)?;
            Ok(serde_json::to_value(list)?)
        }),
        "mark_instance" => with_conn(|conn| {
            let id = args.get("id").and_then(|v| v.as_i64()).ok_or_else(|| AttendoError::InvalidInput("missing id".into()))?;
            let status = args.get("status").and_then(|v| v.as_str());
            let notes = args.get("notes").and_then(|v| v.as_str());
            db::update_instance_status(conn, id, status, notes)?;
            Ok(json!({ "updated": true }))
        }),
        "mark_entire_day" => with_conn(|conn| {
            let date = args.get("date").and_then(|v| v.as_str()).ok_or_else(|| AttendoError::InvalidInput("missing date".into()))?;
            let status = args.get("status").and_then(|v| v.as_str()).ok_or_else(|| AttendoError::InvalidInput("missing status".into()))?;
            let count = db::mark_entire_day_status(conn, date, status)?;
            Ok(json!({ "updated": count }))
        }),
        "shift_instance" => with_conn(|conn| {
            let id = args.get("id").and_then(|v| v.as_i64()).ok_or_else(|| AttendoError::InvalidInput("missing id".into()))?;
            let target_date = args.get("target_date").and_then(|v| v.as_str()).ok_or_else(|| AttendoError::InvalidInput("missing target_date".into()))?;
            let target_start = args.get("target_start_time").and_then(|v| v.as_str()).ok_or_else(|| AttendoError::InvalidInput("missing target_start_time".into()))?;
            let target_end = args.get("target_end_time").and_then(|v| v.as_str()).ok_or_else(|| AttendoError::InvalidInput("missing target_end_time".into()))?;
            let reason = args.get("reason").and_then(|v| v.as_str()).unwrap_or("");
            let is_perm = args.get("is_permanent").and_then(|v| v.as_bool()).unwrap_or(false);
            let new_id = db::shift_lecture_instance(conn, id, target_date, target_start, target_end, reason, is_perm)?;
            Ok(json!({ "new_instance_id": new_id }))
        }),
        "unshift_instance" => with_conn(|conn| {
            let id = args.get("id").and_then(|v| v.as_i64()).ok_or_else(|| AttendoError::InvalidInput("missing id".into()))?;
            db::unshift_lecture_instance(conn, id)?;
            Ok(json!({ "unshifted": true }))
        }),
        "get_edit_history" => with_conn(|conn| {
            let id = args.get("id").and_then(|v| v.as_i64()).ok_or_else(|| AttendoError::InvalidInput("missing id".into()))?;
            let hist = db::get_edit_history(conn, id)?;
            Ok(serde_json::to_value(hist)?)
        }),

        // ---- SIMULATOR ----
        "simulate_attendance" => {
            let attended = args.get("attended").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let conducted = args.get("conducted").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let add_att = args.get("additional_attended").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let add_miss = args.get("additional_missed").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let target = args.get("target_percent").and_then(|v| v.as_i64()).unwrap_or(75) as i32;
            let res = attendance_engine::simulate_attendance_outcome(attended, conducted, add_att, add_miss, target);
            Ok(serde_json::to_value(res)?)
        }

        // ---- TODOS ----
        "get_todos" => with_conn(|conn| {
            let list = db::get_all_todos(conn)?;
            Ok(serde_json::to_value(list)?)
        }),
        "add_todo" => with_conn(|conn| {
            let input: TodoInput = serde_json::from_value(args.clone())?;
            let id = db::add_todo(conn, &input)?;
            Ok(json!({ "id": id }))
        }),
        "toggle_todo" => with_conn(|conn| {
            let id = args.get("id").and_then(|v| v.as_i64()).ok_or_else(|| AttendoError::InvalidInput("missing id".into()))?;
            db::toggle_todo(conn, id)?;
            Ok(json!({ "toggled": true }))
        }),
        "delete_todo" => with_conn(|conn| {
            let id = args.get("id").and_then(|v| v.as_i64()).ok_or_else(|| AttendoError::InvalidInput("missing id".into()))?;
            db::delete_todo(conn, id)?;
            Ok(json!({ "deleted": true }))
        }),

        // ---- SETTINGS ----
        "get_setting" => with_conn(|conn| {
            let key = args.get("key").and_then(|v| v.as_str()).ok_or_else(|| AttendoError::InvalidInput("missing key".into()))?;
            let val = db::get_setting(conn, key)?;
            Ok(json!({ "value": val }))
        }),
        "set_setting" => with_conn(|conn| {
            let key = args.get("key").and_then(|v| v.as_str()).ok_or_else(|| AttendoError::InvalidInput("missing key".into()))?;
            let val = args.get("value").and_then(|v| v.as_str()).ok_or_else(|| AttendoError::InvalidInput("missing value".into()))?;
            db::set_setting(conn, key, val)?;
            Ok(json!({ "saved": true }))
        }),

        // ---- ACCOUNT SYNC & CLOUD BACKUP ----
        "get_sync_info" => with_conn(|conn| {
            let key = sync::get_or_generate_sync_key(conn)?;
            let last = sync::get_last_sync_time(conn)?;
            Ok(json!({ "syncKey": key, "lastSync": last }))
        }),
        "backup_to_cloud" => with_conn(|conn| {
            let res = sync::backup_to_cloud(conn, None)?;
            Ok(serde_json::to_value(res)?)
        }),
        "restore_from_cloud" => with_conn(|conn| {
            let code = args.get("code").and_then(|v| v.as_str()).ok_or_else(|| AttendoError::InvalidInput("missing code".into()))?;
            let mode = args.get("mode").and_then(|v| v.as_str()).unwrap_or("merge");
            let res = sync::restore_from_cloud(conn, code, mode)?;
            Ok(serde_json::to_value(res)?)
        }),

        // ---- TIMETABLE & SEARCH ----
        "needle_extract_timetable" => {
            let raw = args.get("raw_text").and_then(|v| v.as_str()).unwrap_or("");
            ai_agent::extract_timetable_from_text(raw)
        }
        "import_extracted_timetable" => with_conn(|conn| {
            let slots = args.get("slots").and_then(|v| v.as_array()).cloned().unwrap_or_default();
            let count = ai_agent::import_extracted_timetable(conn, &slots)?;
            Ok(json!({ "imported": count }))
        }),
        "needle_extract_todos" => {
            let raw = args.get("raw_text").and_then(|v| v.as_str()).unwrap_or("");
            ai_agent::extract_todos_from_text(raw)
        }
        "needle_semantic_search" => with_conn(|conn| {
            let query = args.get("query").and_then(|v| v.as_str()).unwrap_or("");
            ai_agent::semantic_search(conn, query)
        }),
        "get_distillation_stats" => with_conn(|conn| {
            let (total, recent) = db::get_distillation_stats(conn)?;
            Ok(json!({ "totalSamples": total, "recent": recent }))
        }),

        // ---- PROXY AI ----
        "send_ai_chat" => with_conn(|conn| {
            let prompt = args.get("prompt").and_then(|v| v.as_str()).ok_or_else(|| AttendoError::InvalidInput("missing prompt".into()))?;
            let history: Vec<ChatMessage> = args
                .get("history")
                .and_then(|v| serde_json::from_value(v.clone()).ok())
                .unwrap_or_default();
            let (content, action_card) = ai_agent::send_chat_message(conn, prompt, &history)?;
            Ok(json!({ "content": content, "actionCard": action_card }))
        }),

        // ---- STUDENT PROFILE, SEARCH, BUGS, UPDATES ----
        "get_student_profile" => with_conn(|conn| {
            let p = cloud_services::get_local_student_profile(conn)?;
            Ok(serde_json::to_value(p)?)
        }),
        "save_student_profile" => with_conn(|conn| {
            let p: StudentProfile = serde_json::from_value(args.clone())?;
            cloud_services::sync_public_profile(conn, &p)?;
            Ok(json!({ "saved": true }))
        }),
        "search_students" => {
            let query = args.get("query").and_then(|v| v.as_str()).unwrap_or("");
            let college = args.get("college").and_then(|v| v.as_str());
            let list = cloud_services::search_students(query, college)?;
            Ok(serde_json::to_value(list)?)
        }
        "get_local_bugs" => with_conn(|conn| {
            let list = db::get_local_bugs(conn)?;
            Ok(serde_json::to_value(list)?)
        }),
        "submit_bug_report" => with_conn(|conn| {
            let title = args.get("title").and_then(|v| v.as_str()).unwrap_or("");
            let desc = args.get("description").and_then(|v| v.as_str()).unwrap_or("");
            let cat = args.get("category").and_then(|v| v.as_str()).unwrap_or("general");
            let sev = args.get("severity").and_then(|v| v.as_str()).unwrap_or("low");
            let steps = args.get("steps").and_then(|v| v.as_str());
            let id = cloud_services::submit_bug_report(conn, title, desc, cat, sev, steps)?;
            Ok(json!({ "id": id }))
        }),
        // ---- RECOVERY VAULT ----
        "get_deleted_history" => with_conn(|conn| {
            let list = db::list_deleted_records(conn)?;
            Ok(serde_json::to_value(list)?)
        }),
        "restore_deleted_item" => with_conn(|conn| {
            let res = if let Some(id) = args.get("audit_id").and_then(|v| v.as_i64()) {
                db::restore_deleted_record(conn, id)?
            } else {
                let q = args.get("query").and_then(|v| v.as_str());
                db::find_and_restore_deleted(conn, q)?
            };
            Ok(serde_json::to_value(res)?)
        }),
        "undo_last_edit" => with_conn(|conn| {
            let msg = db::undo_last_attendance_edit(conn)?;
            Ok(json!({ "message": msg }))
        }),

        "check_github_update" => {
            let code = args.get("version_code").and_then(|v| v.as_i64()).unwrap_or(1001) as i32;
            let res = cloud_services::check_for_github_update(code)?;
            Ok(serde_json::to_value(res)?)
        }
        "apply_apk_patch" => {
            let old_apk = args.get("old_apk_path").and_then(|v| v.as_str()).ok_or_else(|| AttendoError::InvalidInput("missing old_apk_path".into()))?;
            let patch = args.get("patch_path").and_then(|v| v.as_str()).ok_or_else(|| AttendoError::InvalidInput("missing patch_path".into()))?;
            let out_apk = args.get("out_apk_path").and_then(|v| v.as_str()).ok_or_else(|| AttendoError::InvalidInput("missing out_apk_path".into()))?;
            let written = delta_patch::apply_apk_patch(old_apk, patch, out_apk)?;
            Ok(json!({ "bytesWritten": written }))
        }

        _ => Err(AttendoError::InvalidInput(format!("Unknown RPC method: {}", method))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{CloudBackupPayload, Subject};

    #[test]
    fn test_attendance_math_safe_bunks() {
        let m = attendance_engine::compute_attendance_metrics(18.0, 20.0, None, 0.0, 0.0, 75);
        assert_eq!(m.percent, 90);
        assert!(m.is_eligible);
        assert_eq!(m.max_bunkable_hours, 4);
        assert_eq!(m.needed_consecutive_hours, 0);
    }

    #[test]
    fn test_attendance_math_danger_zone() {
        let m = attendance_engine::compute_attendance_metrics(6.0, 10.0, None, 0.0, 0.0, 75);
        assert_eq!(m.percent, 60);
        assert!(!m.is_eligible);
        assert_eq!(m.max_bunkable_hours, 0);
        assert_eq!(m.needed_consecutive_hours, 6);
    }

    #[test]
    fn test_security_code_format_and_normalization() {
        for _ in 0..25 {
            let code = sync::generate_security_code();
            assert!(code.starts_with("ATND-"));
            assert_eq!(code.len(), 14);
            assert!(!code.contains('0') && !code.contains('1') && !code.contains('I') && !code.contains('O'));
        }
        assert_eq!(sync::normalize_security_code("atnd 8k9l m3qp"), "ATND-8K9L-M3QP");
        assert_eq!(sync::normalize_security_code("8k9lm3qp"), "ATND-8K9L-M3QP");
    }

    #[test]
    fn test_shift_and_bulletproof_unshift_db() {
        let conn = db::open_and_init(":memory:").expect("init in-memory db");
        let subj_id = db::add_subject(
            &conn,
            &SubjectInput {
                name: "Operating Systems".into(),
                color: "#8B5CF6".into(),
                target_percent: 75,
                subject_type: "theory".into(),
                is_frozen: 0,
                past_attended: 0,
                past_total: 0,
                credits: 4,
            },
        )
        .unwrap();

        let _tt_id = db::add_timetable_entry(
            &conn,
            &TimetableEntryInput {
                subject_id: subj_id,
                day_of_week: "Monday".into(),
                start_time: "09:00".into(),
                end_time: "10:00".into(),
                room: "LH-1".into(),
            },
        )
        .unwrap();

        // 2026-11-30 is Monday
        let classes = db::get_instances_for_date(&conn, "2026-11-30").unwrap();
        assert_eq!(classes.len(), 1);
        let orig_id = classes[0].id;

        // Shift to Tuesday 2026-12-01 14:00-15:00
        let override_id = db::shift_lecture_instance(
            &conn,
            orig_id,
            "2026-12-01",
            "14:00",
            "15:00",
            "Extra lab",
            false,
        )
        .unwrap();

        let mon = db::get_instances_for_date(&conn, "2026-11-30").unwrap();
        assert_eq!(mon[0].status.as_deref(), Some("shifted"));

        let tue = db::get_instances_for_date(&conn, "2026-12-01").unwrap();
        assert!(tue.iter().any(|c| c.id == override_id && c.is_override == 1));

        // Unshift from the override destination slot
        db::unshift_lecture_instance(&conn, override_id).unwrap();

        let mon_after = db::get_instances_for_date(&conn, "2026-11-30").unwrap();
        assert_eq!(mon_after[0].status, None);

        let tue_after = db::get_instances_for_date(&conn, "2026-12-01").unwrap();
        assert!(!tue_after.iter().any(|c| c.is_override == 1));
    }

    #[test]
    fn test_merge_preserves_new_key_not_old() {
        let mut conn = db::open_and_init(":memory:").unwrap();
        let active_key = sync::get_or_generate_sync_key(&conn).unwrap();
        assert!(active_key.starts_with("ATND-"));

        let payload = CloudBackupPayload {
            schema_version: 2,
            app_version: "8.1.4".into(),
            exported_at: "2026-11-21T00:00:00Z".into(),
            checksum: "00000001".into(),
            subjects: vec![Subject {
                id: 99,
                name: "Algorithms".into(),
                color: "#06B6D4".into(),
                target_percent: 75,
                subject_type: "theory".into(),
                is_frozen: 0,
                past_attended: 10,
                past_total: 12,
                credits: 4,
            }],
            timetable: vec![],
            instances: vec![],
            overrides: vec![],
            todos: vec![],
        };

        let (subjs, _) = sync::apply_restored_payload(&mut conn, &payload, "merge").unwrap();
        assert_eq!(subjs, 1);
        // Active key remains the new device key
        assert_eq!(sync::get_or_generate_sync_key(&conn).unwrap(), active_key);
    }

    #[test]
    fn test_custom_rust_ai_full_control_and_db_recovery() {
        let mut conn = db::open_and_init(":memory:").unwrap();

        // 1. Add subject via natural prompt (offline Rust fallback)
        let (r1, _) = ai_agent::execute_rust_offline_fallback(&mut conn, "add subject Operating Systems theory 4 credits").unwrap();
        assert!(r1.contains("Operating Systems"), "got: {}", r1);
        assert_eq!(db::get_all_subjects(&conn).unwrap().len(), 1);

        // 2. Schedule timetable slot via prompt
        let (r2, _) = ai_agent::execute_rust_offline_fallback(&mut conn, "schedule Operating Systems Monday 10:00 to 11:00 in LH1").unwrap();
        assert!(r2.contains("Monday"), "got: {}", r2);
        assert_eq!(db::get_all_timetable_entries(&conn).unwrap().len(), 1);

        // 3. Accidentally delete subject via prompt
        let (r3, _) = ai_agent::execute_rust_offline_fallback(&mut conn, "delete subject Operating Systems").unwrap();
        assert!(r3.contains("Operating Systems"), "got: {}", r3);
        assert_eq!(db::get_all_subjects(&conn).unwrap().len(), 0);
        assert_eq!(db::list_deleted_records(&conn).unwrap().len(), 1);

        // 4. Ask Rust AI to recover deleted subject + its timetable from DB!
        let (r4, card) = ai_agent::execute_rust_offline_fallback(&mut conn, "i accidentally deleted Operating Systems class help me recover it from database").unwrap();
        assert!(r4.contains("Operating Systems"), "got: {}", r4);
        assert!(card.is_some());
        assert_eq!(db::get_all_subjects(&conn).unwrap().len(), 1);
        assert_eq!(db::get_all_timetable_entries(&conn).unwrap().len(), 1);

        // 5. Verify distillation log
        db::log_distillation_sample(&conn, "recover os", "recover_deleted", "[]", "Restored", "groq").unwrap();
        let (total, _) = db::get_distillation_stats(&conn).unwrap();
        assert_eq!(total, 1);
    }
}
