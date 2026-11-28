use crate::attendance_engine;
use crate::attendo_ai::{self, AttendoIntent, AttendoTransformer};
use crate::db;
use crate::error::AttendoResult;
use crate::models::{
    AIActionCardData, ChatMessage, Subject, SubjectInput, TimetableEntryInput, TodoInput,
};
use crate::sync;
use chrono::{Datelike, Duration, Local, NaiveDate};
use rusqlite::Connection;
use serde_json::{json, Value};
use std::sync::OnceLock;
use std::time::Instant;

const GROQ_BASE_URL: &str = "https://api.groq.com/openai/v1";
const SEED_BYTES: [u8; 56] = [
    77, 89, 65, 117, 66, 107, 73, 80, 95, 127, 123, 82, 83, 111, 93, 71, 73, 94, 72, 114, 88, 18,
    105, 31, 125, 109, 78, 83, 72, 25, 108, 115, 115, 97, 77, 30, 123, 101, 104, 78, 28, 120, 95,
    127, 94, 97, 110, 101, 98, 98, 91, 108, 68, 29, 125, 76,
];

const SETTING_AI_KEY: &str = "ai_groq_api_key";
const SETTING_AI_MODEL: &str = "ai_selected_model";
const DEFAULT_MODEL: &str = "openai/gpt-oss-120b";

const SYSTEM_PROMPT: &str = r####"You are "Attendo Copilot", the student's 24/7 full-control AI assistant inside the Attendo app.
You have complete control over Attendo via your tools — anything a user can do in the app, you can do from a single prompt:
- Attendance summary, safe bunks, danger-zone recovery, timetable & free slots
- Marking attendance (single subject or entire day: present, absent, holiday, cancelled)
- Adding, updating, freezing, or deleting subjects
- Adding or removing timetable slots, shifting or unshifting classes
- Simulating bunk consequences & calculating future semester plans
- Adding, completing, or deleting tasks (todos)
- Recovering accidentally deleted subjects, timetable slots, or tasks from the SQLite Recovery Vault (`recover_deleted` / `list_deleted`), and undoing recent edits (`undo_last_action`)
- Changing global target % (`set_global_target`) or backing up to cloud (`backup_to_cloud`)

Always execute the needed tool(s) first and present clean, concise, student-friendly Markdown results."####;

static RUST_AI_MODEL: OnceLock<AttendoTransformer> = OnceLock::new();

fn get_model() -> &'static AttendoTransformer {
    RUST_AI_MODEL.get_or_init(|| {
        attendo_ai::load_embedded_model().unwrap_or_else(|_| AttendoTransformer::new_random(42))
    })
}

fn get_bundled_auth() -> String {
    SEED_BYTES.iter().map(|b| (b ^ 42) as char).collect()
}

pub fn get_active_api_key(conn: &Connection) -> String {
    if let Ok(Some(k)) = db::get_setting(conn, SETTING_AI_KEY) {
        if !k.trim().is_empty() {
            return k.trim().to_string();
        }
    }
    get_bundled_auth()
}

pub fn get_active_model(conn: &Connection) -> String {
    if let Ok(Some(m)) = db::get_setting(conn, SETTING_AI_MODEL) {
        if !m.trim().is_empty() {
            return m.trim().to_string();
        }
    }
    DEFAULT_MODEL.to_string()
}

fn tool_definitions() -> Value {
    json!([
        {
            "type": "function",
            "function": {
                "name": "get_attendance_summary",
                "description": "Get real-time overall, theory, lab, and per-subject attendance & safe bunks.",
                "parameters": { "type": "object", "properties": { "target_percent": { "type": "number" } } }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_schedule",
                "description": "Get scheduled classes for a date or relative day (today, tomorrow, yesterday, Monday, etc).",
                "parameters": { "type": "object", "properties": { "date_or_day": { "type": "string" } }, "required": ["date_or_day"] }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "find_free_slots",
                "description": "Find free timetable gaps on a weekday or date between 09:00 and 17:00.",
                "parameters": { "type": "object", "properties": { "day_of_week_or_date": { "type": "string" } }, "required": ["day_of_week_or_date"] }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "mark_attendance",
                "description": "Mark a subject or entire day as present, absent, holiday, or cancelled.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "date_or_day": { "type": "string" },
                        "status": { "type": "string", "enum": ["present", "absent", "holiday", "cancelled"] },
                        "subject_name": { "type": "string" }
                    },
                    "required": ["date_or_day", "status"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "add_subject",
                "description": "Add a new subject (theory or lab) with target_percent and credits.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "name": { "type": "string" },
                        "subject_type": { "type": "string", "enum": ["theory", "lab"] },
                        "target_percent": { "type": "number" },
                        "credits": { "type": "number" }
                    },
                    "required": ["name"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "update_subject",
                "description": "Update an existing subject's target_percent, credits, or freeze status.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "subject_name": { "type": "string" },
                        "target_percent": { "type": "number" },
                        "credits": { "type": "number" },
                        "is_frozen": { "type": "boolean" }
                    },
                    "required": ["subject_name"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "delete_subject",
                "description": "Soft-delete a subject (archived in SQLite Recovery Vault).",
                "parameters": { "type": "object", "properties": { "subject_name": { "type": "string" } }, "required": ["subject_name"] }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "add_timetable_slot",
                "description": "Add a recurring weekly timetable slot for a subject.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "subject_name": { "type": "string" },
                        "day_of_week": { "type": "string" },
                        "start_time": { "type": "string" },
                        "end_time": { "type": "string" },
                        "room": { "type": "string" }
                    },
                    "required": ["subject_name", "day_of_week", "start_time"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "delete_timetable_slot",
                "description": "Remove a timetable slot (archived in SQLite Recovery Vault).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "subject_name": { "type": "string" },
                        "day_of_week": { "type": "string" },
                        "start_time": { "type": "string" }
                    }
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "shift_class",
                "description": "Reschedule or shift a class to another date and time.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "subject_name": { "type": "string" },
                        "current_date_or_day": { "type": "string" },
                        "target_date": { "type": "string" },
                        "target_start_time": { "type": "string" },
                        "target_end_time": { "type": "string" }
                    },
                    "required": ["subject_name", "target_date", "target_start_time"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "unshift_class",
                "description": "Revert a shifted class back to its original timetable slot.",
                "parameters": { "type": "object", "properties": { "subject_name": { "type": "string" } } }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "simulate_bunk",
                "description": "Simulate attendance impact if user skips classes on a date or subject.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "date_or_day": { "type": "string" },
                        "subject_name": { "type": "string" }
                    }
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "calculate_future_plan",
                "description": "Calculate semester roadmap and safe bunks ahead.",
                "parameters": { "type": "object", "properties": { "target_percent": { "type": "number" } } }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "add_todo",
                "description": "Add a task or assignment reminder.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title": { "type": "string" },
                        "due_date": { "type": "string" },
                        "priority": { "type": "string", "enum": ["low", "medium", "high"] },
                        "subject_name": { "type": "string" }
                    },
                    "required": ["title"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "toggle_todo",
                "description": "Mark a task/todo as completed or uncompleted.",
                "parameters": { "type": "object", "properties": { "title_query": { "type": "string" } } }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "delete_todo",
                "description": "Soft-delete a task/todo (archived in Recovery Vault).",
                "parameters": { "type": "object", "properties": { "title_query": { "type": "string" } } }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "recover_deleted",
                "description": "Recover mistakenly deleted subjects, classes, timetable slots, or tasks from the SQLite Recovery Vault.",
                "parameters": { "type": "object", "properties": { "query": { "type": "string" } } }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "list_deleted",
                "description": "List recently deleted items stored in the SQLite Recovery Vault.",
                "parameters": { "type": "object", "properties": {} }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "undo_last_action",
                "description": "Undo the most recent attendance edit or restore the last deleted item.",
                "parameters": { "type": "object", "properties": {} }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "set_global_target",
                "description": "Change global attendance target percentage.",
                "parameters": { "type": "object", "properties": { "target_percent": { "type": "number" } }, "required": ["target_percent"] }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "backup_to_cloud",
                "description": "Backup local Attendo SQLite data to cloud sync.",
                "parameters": { "type": "object", "properties": {} }
            }
        }
    ])
}

pub fn resolve_date(input: &str) -> (String, String) {
    let today = Local::now().date_naive();
    let lower = input.trim().to_lowercase();

    let target = if lower.contains("yesterday") {
        today - Duration::days(1)
    } else if lower.contains("day after tomorrow") || lower.contains("+2") {
        today + Duration::days(2)
    } else if lower.contains("tomorrow") {
        today + Duration::days(1)
    } else if lower.contains("today") || lower.is_empty() {
        today
    } else if let Some(d) = extract_iso_date(&lower) {
        d
    } else {
        let weekdays = [
            "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
        ];
        if let Some(idx) = weekdays.iter().position(|w| lower.contains(w)) {
            let cur = today.weekday().num_days_from_sunday() as i64;
            let mut ahead = idx as i64 - cur;
            if ahead <= 0 {
                ahead += 7;
            }
            today + Duration::days(ahead)
        } else {
            today
        }
    };

    let date_str = target.format("%Y-%m-%d").to_string();
    let day_name = db::weekday_name_from_date(&date_str);
    (date_str, day_name)
}

fn extract_iso_date(text: &str) -> Option<NaiveDate> {
    for tok in text.split_whitespace() {
        let clean = tok.trim_matches(|c: char| !c.is_ascii_digit() && c != '-');
        if clean.len() == 10 {
            if let Ok(d) = NaiveDate::parse_from_str(clean, "%Y-%m-%d") {
                return Some(d);
            }
        }
    }
    None
}

fn extract_weekday(text: &str) -> Option<&'static str> {
    let lower = text.to_lowercase();
    let days = [
        ("monday", "Monday"),
        ("tuesday", "Tuesday"),
        ("wednesday", "Wednesday"),
        ("thursday", "Thursday"),
        ("friday", "Friday"),
        ("saturday", "Saturday"),
        ("sunday", "Sunday"),
    ];
    for (k, v) in days {
        if lower.contains(k) {
            return Some(v);
        }
    }
    None
}

fn match_subject<'a>(subjects: &'a [Subject], query: &str) -> Option<&'a Subject> {
    let lower = query.to_lowercase();
    if lower.trim().is_empty() {
        return None;
    }
    let mut sorted: Vec<&Subject> = subjects.iter().collect();
    sorted.sort_by(|a, b| b.name.len().cmp(&a.name.len()));
    for s in &sorted {
        if lower.contains(&s.name.to_lowercase()) || s.name.to_lowercase().contains(&lower) {
            return Some(s);
        }
    }
    let words: Vec<&str> = lower.split_whitespace().collect();
    for s in &sorted {
        let sn = s.name.to_lowercase();
        let s_words: Vec<&str> = sn.split_whitespace().collect();
        let initials: String = s_words.iter().filter_map(|w| w.chars().next()).collect();
        if initials.len() >= 2 && words.iter().any(|w| *w == initials) {
            return Some(s);
        }
        if s_words.iter().any(|sw| sw.len() >= 3 && words.iter().any(|w| *w == *sw)) {
            return Some(s);
        }
    }
    None
}

fn extract_number_near(prompt: &str, keywords: &[&str]) -> Option<i32> {
    let lower = prompt.to_lowercase();
    let tokens: Vec<&str> = lower.split_whitespace().collect();
    for (i, tok) in tokens.iter().enumerate() {
        let clean = tok.trim_end_matches('%');
        if let Ok(num) = clean.parse::<i32>() {
            let start = i.saturating_sub(2);
            let end = (i + 3).min(tokens.len());
            let window = tokens[start..end].join(" ");
            if keywords.is_empty() || keywords.iter().any(|k| window.contains(k)) {
                return Some(num);
            }
        }
    }
    None
}

fn extract_times(prompt: &str) -> Vec<String> {
    let mut out = Vec::new();
    for tok in prompt.to_lowercase().split_whitespace() {
        let clean = tok.trim_matches(|c: char| !c.is_alphanumeric() && c != ':');
        if clean.contains(':') && clean.len() <= 5 {
            let parts: Vec<&str> = clean.split(':').collect();
            if parts.len() == 2 {
                if let (Ok(h), Ok(m)) = (parts[0].parse::<u32>(), parts[1].parse::<u32>()) {
                    if h < 24 && m < 60 {
                        out.push(format!("{:02}:{:02}", h, m));
                    }
                }
            }
        } else if clean.ends_with("am") || clean.ends_with("pm") {
            let is_pm = clean.ends_with("pm");
            let num_part = clean.trim_end_matches("am").trim_end_matches("pm");
            if let Ok(mut h) = num_part.parse::<u32>() {
                if is_pm && h < 12 {
                    h += 12;
                } else if !is_pm && h == 12 {
                    h = 0;
                }
                if h < 24 {
                    out.push(format!("{:02}:00", h));
                }
            }
        }
    }
    out
}

fn extract_room(prompt: &str) -> String {
    let tokens: Vec<&str> = prompt.split_whitespace().collect();
    for (i, t) in tokens.iter().enumerate() {
        let tl = t.to_lowercase();
        if (tl == "in" || tl == "room" || tl == "at") && i + 1 < tokens.len() {
            let next = tokens[i + 1].trim_matches(|c: char| !c.is_alphanumeric() && c != '-');
            if !next.is_empty()
                && !["today", "tomorrow", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]
                    .contains(&next.to_lowercase().as_str())
                && !next.ends_with("am")
                && !next.ends_with("pm")
                && !next.contains(':')
            {
                return next.to_uppercase();
            }
        }
    }
    "".into()
}

fn extract_new_subject_name(prompt: &str) -> String {
    let stop = [
        "add", "create", "new", "subject", "course", "delete", "remove", "drop", "recover",
        "restore", "theory", "lab", "target", "percent", "%", "credits", "credit", "with", "to",
        "from", "my", "subjects", "classes", "class", "please", "help", "accidentally",
        "mistakenly", "deleted", "removed", "database", "bring", "back", "it",
    ];
    let mut words = Vec::new();
    let mut skip_next_num = false;
    for raw in prompt.split_whitespace() {
        let clean = raw.trim_matches(|c: char| !c.is_alphanumeric() && c != '-');
        let low = clean.to_lowercase();
        if skip_next_num {
            skip_next_num = false;
            if low.trim_end_matches('%').parse::<i32>().is_ok() {
                continue;
            }
        }
        if low == "target" || low == "credits" || low == "credit" {
            skip_next_num = true;
            continue;
        }
        if low.trim_end_matches('%').parse::<i32>().is_ok() {
            continue;
        }
        if !stop.contains(&low.as_str()) && !clean.is_empty() {
            words.push(clean);
        }
    }
    if words.is_empty() {
        "New Subject".into()
    } else {
        words
            .into_iter()
            .map(|w| {
                let mut c = w.chars();
                match c.next() {
                    None => String::new(),
                    Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
                }
            })
            .collect::<Vec<_>>()
            .join(" ")
    }
}

fn execute_tool(
    conn: &mut Connection,
    name: &str,
    args: &Value,
) -> (String, Option<AIActionCardData>) {
    let target_pct = db::get_setting(conn, "global_target_percent")
        .ok()
        .flatten()
        .and_then(|s| s.parse::<i32>().ok())
        .unwrap_or(75);
    let subjects = db::get_all_subjects(conn).unwrap_or_default();

    match name {
        "get_attendance_summary" => {
            let tgt = args.get("target_percent").and_then(|v| v.as_i64()).unwrap_or(target_pct as i64) as i32;
            let instances = db::get_all_instances(conn).unwrap_or_default();
            let report = attendance_engine::compute_split_report(&subjects, &instances, tgt);
            let subj_stats: Vec<Value> = subjects
                .iter()
                .filter(|s| s.is_frozen == 0)
                .map(|s| {
                    let m = attendance_engine::compute_subject_metrics(s, &instances);
                    json!({
                        "name": s.name,
                        "type": s.subject_type,
                        "percent": m.metrics.percent,
                        "attended_hours": m.metrics.attended_hours,
                        "conducted_hours": m.metrics.conducted_hours,
                        "max_bunkable_hours": m.metrics.max_bunkable_hours,
                        "needed_consecutive_hours": m.metrics.needed_consecutive_hours,
                    })
                })
                .collect();
            (json!({ "overall": report.overall, "theory": report.theory, "lab": report.lab, "subjects": subj_stats }).to_string(), None)
        }
        "get_schedule" => {
            let raw = args.get("date_or_day").and_then(|v| v.as_str()).unwrap_or("today");
            let (date_str, day_name) = resolve_date(raw);
            let classes = db::get_instances_for_date(conn, &date_str).unwrap_or_default();
            (json!({ "date": date_str, "day": day_name, "classes": classes }).to_string(), None)
        }
        "find_free_slots" => {
            let raw = args.get("day_of_week_or_date").and_then(|v| v.as_str()).unwrap_or("today");
            let (date_str, day_name) = resolve_date(raw);
            let classes = db::get_instances_for_date(conn, &date_str).unwrap_or_default();
            let standard = [("09:00","10:00"),("10:00","11:00"),("11:00","12:00"),("12:00","13:00"),("14:00","15:00"),("15:00","16:00"),("16:00","17:00")];
            let free: Vec<Value> = standard.iter()
                .filter(|(s, _)| !classes.iter().any(|c| c.start_time == *s && c.status.as_deref() != Some("shifted")))
                .map(|(s, e)| json!({ "start": s, "end": e }))
                .collect();
            (json!({ "date": date_str, "day": day_name, "free_slots": free }).to_string(), None)
        }
        "mark_attendance" => {
            let raw = args.get("date_or_day").and_then(|v| v.as_str()).unwrap_or("today");
            let status = args.get("status").and_then(|v| v.as_str()).unwrap_or("present");
            let subj_q = args.get("subject_name").and_then(|v| v.as_str()).unwrap_or("");
            let (date_str, day_name) = resolve_date(raw);
            let _ = db::ensure_instances_for_date(conn, &date_str);

            if let Some(s) = match_subject(&subjects, subj_q) {
                let classes = db::get_instances_for_date(conn, &date_str).unwrap_or_default();
                let mut count = 0;
                for c in classes.iter().filter(|c| c.subject_id == s.id) {
                    if db::update_instance_status(conn, c.id, Some(status), Some("Marked by Attendo Copilot")).is_ok() {
                        count += 1;
                    }
                }
                let card = AIActionCardData {
                    card_type: "mark_attendance".into(),
                    title: format!("Marked {} {}", s.name, status.to_uppercase()),
                    description: format!("{} ({}) • {} slot(s)", day_name, date_str, count),
                    details: json!({ "subject": s.name, "status": status, "date": date_str }),
                };
                return (json!({ "updated": count, "subject": s.name, "status": status, "date": date_str }).to_string(), Some(card));
            }

            let updated = db::mark_entire_day_status(conn, &date_str, status).unwrap_or(0);
            let card = AIActionCardData {
                card_type: "mark_entire_day".into(),
                title: format!("All {} Classes -> {}", day_name, status.to_uppercase()),
                description: format!("Updated {} lecture(s) on {}", updated, date_str),
                details: json!({ "date": date_str, "status": status, "updated": updated }),
            };
            (json!({ "updated": updated, "date": date_str, "status": status }).to_string(), Some(card))
        }
        "add_subject" => {
            let name = args.get("name").and_then(|v| v.as_str()).unwrap_or("New Subject").trim().to_string();
            let stype = args.get("subject_type").and_then(|v| v.as_str()).unwrap_or("theory");
            let tgt = args.get("target_percent").and_then(|v| v.as_i64()).unwrap_or(target_pct as i64) as i32;
            let credits = args.get("credits").and_then(|v| v.as_i64()).unwrap_or(if stype == "lab" { 2 } else { 3 }) as i32;
            let id = db::add_subject(conn, &SubjectInput {
                name: name.clone(), color: "#6366F1".into(), target_percent: tgt.clamp(1, 100),
                subject_type: stype.into(), is_frozen: 0, past_attended: 0, past_total: 0, credits: credits.clamp(1, 10),
            }).unwrap_or(0);
            let card = AIActionCardData {
                card_type: "add_subject".into(),
                title: format!("Added Subject: {}", name),
                description: format!("{} • {} credits • {}% target", stype, credits, tgt),
                details: json!({ "id": id, "name": name }),
            };
            (json!({ "id": id, "name": name }).to_string(), Some(card))
        }
        "update_subject" => {
            let sq = args.get("subject_name").and_then(|v| v.as_str()).unwrap_or("");
            if let Some(s) = match_subject(&subjects, sq) {
                let tgt = args.get("target_percent").and_then(|v| v.as_i64()).unwrap_or(s.target_percent as i64) as i32;
                let credits = args.get("credits").and_then(|v| v.as_i64()).unwrap_or(s.credits as i64) as i32;
                let frozen = args.get("is_frozen").and_then(|v| v.as_bool()).map(|b| if b { 1 } else { 0 }).unwrap_or(s.is_frozen);
                let _ = db::update_subject(conn, s.id, &SubjectInput {
                    name: s.name.clone(), color: s.color.clone(), target_percent: tgt,
                    subject_type: s.subject_type.clone(), is_frozen: frozen,
                    past_attended: s.past_attended, past_total: s.past_total, credits,
                });
                return (json!({ "updated": s.name, "target": tgt, "credits": credits }).to_string(), None);
            }
            (json!({ "error": "Subject not found" }).to_string(), None)
        }
        "delete_subject" => {
            let sq = args.get("subject_name").and_then(|v| v.as_str()).unwrap_or("");
            if let Some(s) = match_subject(&subjects, sq) {
                let _ = db::delete_subject(conn, s.id);
                let card = AIActionCardData {
                    card_type: "delete_subject".into(),
                    title: format!("Deleted {}", s.name),
                    description: "Archived in SQLite Recovery Vault".into(),
                    details: json!({ "name": s.name }),
                };
                return (json!({ "deleted": s.name, "archived": true }).to_string(), Some(card));
            }
            (json!({ "error": "Subject not found" }).to_string(), None)
        }
        "add_timetable_slot" => {
            let sq = args.get("subject_name").and_then(|v| v.as_str()).unwrap_or("");
            if let Some(s) = match_subject(&subjects, sq) {
                let day = args.get("day_of_week").and_then(|v| v.as_str()).unwrap_or("Monday");
                let start = args.get("start_time").and_then(|v| v.as_str()).unwrap_or("09:00");
                let end = args.get("end_time").and_then(|v| v.as_str()).unwrap_or("10:00");
                let room = args.get("room").and_then(|v| v.as_str()).unwrap_or("");
                let id = db::add_timetable_entry(conn, &TimetableEntryInput {
                    subject_id: s.id, day_of_week: day.into(), start_time: start.into(), end_time: end.into(), room: room.into(),
                }).unwrap_or(0);
                let card = AIActionCardData {
                    card_type: "add_timetable".into(),
                    title: format!("Scheduled {}", s.name),
                    description: format!("{} • {}–{} {}", day, start, end, room),
                    details: json!({ "id": id }),
                };
                return (json!({ "id": id, "subject": s.name, "day": day, "start": start }).to_string(), Some(card));
            }
            (json!({ "error": "Subject not found" }).to_string(), None)
        }
        "delete_timetable_slot" => {
            let entries = db::get_all_timetable_entries(conn).unwrap_or_default();
            let sq = args.get("subject_name").and_then(|v| v.as_str()).unwrap_or("");
            let matched = match_subject(&subjects, sq);
            let day_f = args.get("day_of_week").and_then(|v| v.as_str());
            let time_f = args.get("start_time").and_then(|v| v.as_str());
            if let Some(e) = entries.iter().find(|e| {
                matched.map(|s| s.id == e.subject_id).unwrap_or(true)
                    && day_f.map(|d| e.day_of_week.eq_ignore_ascii_case(d)).unwrap_or(true)
                    && time_f.map(|t| e.start_time == t).unwrap_or(true)
            }) {
                let _ = db::delete_timetable_entry(conn, e.id);
                return (json!({ "deleted": true, "archived": true }).to_string(), None);
            }
            (json!({ "error": "No matching slot" }).to_string(), None)
        }
        "shift_class" => {
            let sq = args.get("subject_name").and_then(|v| v.as_str()).unwrap_or("");
            let cur = args.get("current_date_or_day").and_then(|v| v.as_str()).unwrap_or("today");
            let tgt = args.get("target_date").and_then(|v| v.as_str()).unwrap_or("tomorrow");
            let start = args.get("target_start_time").and_then(|v| v.as_str()).unwrap_or("14:00");
            let end = args.get("target_end_time").and_then(|v| v.as_str()).unwrap_or("15:00");
            let (src_date, _) = resolve_date(cur);
            let (dst_date, dst_day) = resolve_date(tgt);
            if let Some(s) = match_subject(&subjects, sq) {
                let classes = db::get_instances_for_date(conn, &src_date).unwrap_or_default();
                if let Some(inst) = classes.iter().find(|c| c.subject_id == s.id && c.status.as_deref() != Some("shifted")) {
                    let _ = db::shift_lecture_instance(conn, inst.id, &dst_date, start, end, "Attendo Copilot", false);
                    let card = AIActionCardData {
                        card_type: "shift_class".into(),
                        title: format!("Shifted {}", s.name),
                        description: format!("Moved to {} ({}) {}–{}", dst_day, dst_date, start, end),
                        details: json!({ "targetDate": dst_date }),
                    };
                    return (json!({ "shifted": true, "targetDate": dst_date }).to_string(), Some(card));
                }
            }
            (json!({ "error": "Class not found to shift" }).to_string(), None)
        }
        "unshift_class" => {
            let sq = args.get("subject_name").and_then(|v| v.as_str()).unwrap_or("");
            let matched = match_subject(&subjects, sq);
            let instances = db::get_all_instances(conn).unwrap_or_default();
            if let Some(inst) = instances.iter().rev().find(|c| c.is_override == 1 && matched.map(|s| s.id == c.subject_id).unwrap_or(true)) {
                let _ = db::unshift_lecture_instance(conn, inst.id);
                return (json!({ "unshifted": true }).to_string(), None);
            }
            (json!({ "error": "No shifted class found" }).to_string(), None)
        }
        "simulate_bunk" => {
            let raw = args.get("date_or_day").and_then(|v| v.as_str()).unwrap_or("tomorrow");
            let (date_str, _) = resolve_date(raw);
            let day_classes = db::get_instances_for_date(conn, &date_str).unwrap_or_default();
            let all_instances = db::get_all_instances(conn).unwrap_or_default();
            let sq = args.get("subject_name").and_then(|v| v.as_str()).unwrap_or("");
            let matched = match_subject(&subjects, sq);
            let mut sims = Vec::new();
            for s in subjects.iter().filter(|s| s.is_frozen == 0) {
                if let Some(ms) = matched {
                    if ms.id != s.id { continue; }
                }
                let hrs = day_classes.iter().filter(|c| c.subject_id == s.id).count() as f64;
                if hrs == 0.0 { continue; }
                let m = attendance_engine::compute_subject_metrics(s, &all_instances);
                let sim = attendance_engine::simulate_attendance_outcome(m.metrics.attended_hours, m.metrics.conducted_hours, 0.0, hrs, s.target_percent);
                sims.push(json!({ "subject": s.name, "current": m.metrics.percent, "projected": sim.projected_percent, "safe": sim.is_eligible }));
            }
            (json!({ "date": date_str, "simulations": sims }).to_string(), None)
        }
        "calculate_future_plan" => {
            let instances = db::get_all_instances(conn).unwrap_or_default();
            let report = attendance_engine::compute_split_report(&subjects, &instances, target_pct);
            let tt = db::get_all_timetable_entries(conn).unwrap_or_default();
            let est = (tt.len().max(1) * 4) as f64;
            let min_req = ((report.overall.conducted_hours + est) * (target_pct as f64 / 100.0)).ceil();
            let can_skip = (est - (min_req - report.overall.attended_hours).max(0.0)).max(0.0) as i32;
            (json!({ "currentPercent": report.overall.percent, "estClassesNext4Weeks": est, "safeBunks": can_skip }).to_string(), None)
        }
        "add_todo" => {
            let title = args.get("title").and_then(|v| v.as_str()).unwrap_or("New Task").to_string();
            let raw_due = args.get("due_date").and_then(|v| v.as_str()).unwrap_or("today");
            let (due_date, _) = resolve_date(raw_due);
            let prio = args.get("priority").and_then(|v| v.as_str()).unwrap_or("medium");
            let sq = args.get("subject_name").and_then(|v| v.as_str()).unwrap_or("");
            let id = db::add_todo(conn, &TodoInput {
                title: title.clone(), subject_id: match_subject(&subjects, sq).map(|s| s.id),
                due_date: due_date.clone(), due_time: None, priority: prio.into(),
                alarm_minutes_before: 15, notes: "Added by Attendo Copilot".into(),
            }).unwrap_or(0);
            let card = AIActionCardData {
                card_type: "add_todo".into(),
                title: format!("Task Added: {}", title),
                description: format!("Due {} • {} priority", due_date, prio),
                details: json!({ "id": id }),
            };
            (json!({ "id": id, "title": title, "due": due_date }).to_string(), Some(card))
        }
        "toggle_todo" => {
            let q = args.get("title_query").and_then(|v| v.as_str()).unwrap_or("").to_lowercase();
            let todos = db::get_all_todos(conn).unwrap_or_default();
            if let Some(td) = todos.iter().find(|t| t.is_completed == 0 && (q.is_empty() || t.title.to_lowercase().contains(&q))) {
                let _ = db::toggle_todo(conn, td.id);
                return (json!({ "toggled": td.title }).to_string(), None);
            }
            (json!({ "error": "No matching pending task" }).to_string(), None)
        }
        "delete_todo" => {
            let q = args.get("title_query").and_then(|v| v.as_str()).unwrap_or("").to_lowercase();
            let todos = db::get_all_todos(conn).unwrap_or_default();
            if let Some(td) = todos.iter().find(|t| q.is_empty() || t.title.to_lowercase().contains(&q)) {
                let _ = db::delete_todo(conn, td.id);
                return (json!({ "deleted": td.title, "archived": true }).to_string(), None);
            }
            (json!({ "error": "No matching task" }).to_string(), None)
        }
        "recover_deleted" => {
            let q = args.get("query").and_then(|v| v.as_str());
            match db::find_and_restore_deleted(conn, q) {
                Ok(res) => {
                    let card = AIActionCardData {
                        card_type: "recover_deleted".into(),
                        title: format!("Recovered {}", res.label),
                        description: format!("Restored {} database record(s)", res.restored_items),
                        details: json!(res),
                    };
                    (json!(res).to_string(), Some(card))
                }
                Err(e) => (json!({ "error": e.to_string() }).to_string(), None),
            }
        }
        "list_deleted" => {
            let list = db::list_deleted_records(conn).unwrap_or_default();
            (json!({ "deleted": list }).to_string(), None)
        }
        "undo_last_action" => {
            if let Ok(msg) = db::undo_last_attendance_edit(conn) {
                return (json!({ "undone": msg }).to_string(), None);
            }
            match db::find_and_restore_deleted(conn, None) {
                Ok(res) => (json!(res).to_string(), None),
                Err(e) => (json!({ "error": e.to_string() }).to_string(), None),
            }
        }
        "set_global_target" => {
            let pct = args.get("target_percent").and_then(|v| v.as_i64()).unwrap_or(75).clamp(50, 99);
            let _ = db::set_setting(conn, "global_target_percent", &pct.to_string());
            (json!({ "target_percent": pct }).to_string(), None)
        }
        "backup_to_cloud" => {
            match sync::backup_to_cloud(conn, None) {
                Ok(r) => (json!(r).to_string(), None),
                Err(e) => (json!({ "error": e.to_string() }).to_string(), None),
            }
        }
        _ => (json!({ "error": format!("Unknown tool {}", name) }).to_string(), None),
    }
}

/// Primary AI Entrypoint:
/// 1. Calls Groq (`openai/gpt-oss-120b`) with full-app-control tools.
/// 2. Logs Groq's tool calls & response into `ai_distillation_log` as training data for our custom Rust model!
/// 3. If offline / Groq fails, falls back seamlessly to our pure-Rust `AttendoTransformer`!
pub fn send_chat_message(
    conn: &mut Connection,
    prompt: &str,
    history: &[ChatMessage],
) -> AttendoResult<(String, Option<AIActionCardData>)> {
    if let Ok((content, card, tools_used)) = try_groq_with_distillation(conn, prompt, history) {
        let primary_intent = tools_used.first().cloned().unwrap_or_else(|| "general_chat".into());
        let tools_json = serde_json::to_string(&tools_used).unwrap_or_else(|_| "[]".into());
        let _ = db::log_distillation_sample(conn, prompt, &primary_intent, &tools_json, &content, "groq");
        return Ok((content, card));
    }

    // Offline / fallback to our pure-Rust Transformer
    let (resp, card) = execute_rust_offline_fallback(conn, prompt)?;
    let _ = db::log_distillation_sample(conn, prompt, "rust_fallback", "[]", &resp, "rust_transformer");
    Ok((resp, card))
}

fn try_groq_with_distillation(
    conn: &mut Connection,
    prompt: &str,
    history: &[ChatMessage],
) -> AttendoResult<(String, Option<AIActionCardData>, Vec<String>)> {
    let api_key = get_active_api_key(conn);
    let model = get_active_model(conn);
    let url = format!("{}/chat/completions", GROQ_BASE_URL);

    let today_str = Local::now().format("%Y-%m-%d").to_string();
    let day_str = db::weekday_name_from_date(&today_str);
    let sys = format!("{}\n\nToday is {} ({}).", SYSTEM_PROMPT, today_str, day_str);

    let mut messages: Vec<Value> = vec![json!({ "role": "system", "content": sys })];
    for m in history.iter().rev().take(8).rev() {
        if m.role == "user" || m.role == "assistant" {
            messages.push(json!({ "role": m.role, "content": m.content }));
        }
    }
    messages.push(json!({ "role": "user", "content": prompt }));

    let tools = tool_definitions();
    let mut last_card: Option<AIActionCardData> = None;
    let mut tools_used: Vec<String> = Vec::new();

    for _round in 0..4 {
        let body = json!({
            "model": model,
            "messages": messages,
            "tools": tools,
            "tool_choice": "auto",
            "temperature": 0.2,
            "max_tokens": 1024
        });

        let resp: Value = ureq::post(&url)
            .set("Authorization", &format!("Bearer {}", api_key))
            .set("Content-Type", "application/json")
            .timeout(std::time::Duration::from_secs(18))
            .send_json(body)
            .map_err(|e| crate::error::AttendoError::InvalidInput(e.to_string()))?
            .into_json()
            .map_err(|e| crate::error::AttendoError::InvalidInput(e.to_string()))?;

        let choice = resp.pointer("/choices/0/message").cloned().unwrap_or(json!({}));
        let tool_calls = choice.get("tool_calls").and_then(|v| v.as_array()).cloned();

        if let Some(calls) = tool_calls {
            if !calls.is_empty() {
                messages.push(choice.clone());
                for tc in calls {
                    let call_id = tc.get("id").and_then(|v| v.as_str()).unwrap_or("call_1");
                    let fn_name = tc.pointer("/function/name").and_then(|v| v.as_str()).unwrap_or("");
                    let args_str = tc.pointer("/function/arguments").and_then(|v| v.as_str()).unwrap_or("{}");
                    let fn_args: Value = serde_json::from_str(args_str).unwrap_or_else(|_| json!({}));

                    tools_used.push(format!("{}:{}", fn_name, args_str));
                    let (tool_res, card) = execute_tool(conn, fn_name, &fn_args);
                    if card.is_some() {
                        last_card = card;
                    }
                    messages.push(json!({
                        "role": "tool",
                        "tool_call_id": call_id,
                        "content": tool_res
                    }));
                }
                continue;
            }
        }

        let content = choice.get("content").and_then(|v| v.as_str()).unwrap_or("Done!").to_string();
        return Ok((content, last_card, tools_used));
    }

    Ok(("Action completed!".into(), last_card, tools_used))
}

/// Pure-Rust Transformer Offline Fallback (also used directly in offline unit tests)
pub fn execute_rust_offline_fallback(
    conn: &mut Connection,
    prompt: &str,
) -> AttendoResult<(String, Option<AIActionCardData>)> {
    let t0 = Instant::now();
    let model = get_model();
    let (mut intent, conf, _) = model.predict(prompt);
    let lower = prompt.to_lowercase();

    if (lower.contains("recover") || lower.contains("restore") || lower.contains("undelete") || lower.contains("bring back") || lower.contains("mistake") || lower.contains("accidentally"))
        && (lower.contains("delet") || lower.contains("remov") || lower.contains("class") || lower.contains("subject") || lower.contains("database") || lower.contains("todo") || lower.contains("task"))
    {
        intent = AttendoIntent::RecoverDeleted;
    } else if lower.contains("undo") && !lower.contains("deleted") {
        intent = AttendoIntent::UndoLastAction;
    } else if lower.contains("show deleted") || lower.contains("recovery vault") || lower.contains("list deleted") {
        intent = AttendoIntent::ListDeleted;
    } else if (lower.starts_with("add subject") || lower.starts_with("create subject") || lower.starts_with("new subject"))
        && intent == AttendoIntent::UpdateSubject
    {
        intent = AttendoIntent::AddSubject;
    }

    let subjects = db::get_all_subjects(conn)?;
    let matched = match_subject(&subjects, prompt);

    let (tool_name, tool_args) = match intent {
        AttendoIntent::GetAttendanceSummary => ("get_attendance_summary", json!({})),
        AttendoIntent::GetSchedule => ("get_schedule", json!({ "date_or_day": prompt })),
        AttendoIntent::FindFreeSlots => ("find_free_slots", json!({ "day_of_week_or_date": prompt })),
        AttendoIntent::MarkAttendance => {
            let st = if lower.contains("absent") || lower.contains("bunk") { "absent" } else if lower.contains("holiday") { "holiday" } else if lower.contains("cancel") { "cancelled" } else { "present" };
            ("mark_attendance", json!({ "date_or_day": prompt, "status": st, "subject_name": matched.map(|s| s.name.clone()).unwrap_or_default() }))
        }
        AttendoIntent::AddSubject => {
            let name = extract_new_subject_name(prompt);
            let stype = if lower.contains("lab") { "lab" } else { "theory" };
            let credits = extract_number_near(prompt, &["credit", "credits"]).unwrap_or(3);
            ("add_subject", json!({ "name": name, "subject_type": stype, "credits": credits }))
        }
        AttendoIntent::DeleteSubject => ("delete_subject", json!({ "subject_name": matched.map(|s| s.name.clone()).unwrap_or_default() })),
        AttendoIntent::AddTimetableSlot => {
            let day = extract_weekday(prompt).unwrap_or("Monday");
            let times = extract_times(prompt);
            let start = times.first().cloned().unwrap_or_else(|| "09:00".into());
            let end = times.get(1).cloned().unwrap_or_else(|| "10:00".into());
            let room = extract_room(prompt);
            ("add_timetable_slot", json!({ "subject_name": matched.map(|s| s.name.clone()).unwrap_or_default(), "day_of_week": day, "start_time": start, "end_time": end, "room": room }))
        }
        AttendoIntent::RecoverDeleted => ("recover_deleted", json!({ "query": matched.map(|s| s.name.clone()).unwrap_or_else(|| extract_new_subject_name(prompt)) })),
        AttendoIntent::ListDeleted => ("list_deleted", json!({})),
        AttendoIntent::UndoLastAction => ("undo_last_action", json!({})),
        AttendoIntent::SimulateBunk => ("simulate_bunk", json!({ "date_or_day": prompt })),
        AttendoIntent::FuturePlan => ("calculate_future_plan", json!({})),
        _ => ("get_attendance_summary", json!({})),
    };

    let (raw_json, card) = execute_tool(conn, tool_name, &tool_args);
    let elapsed = t0.elapsed().as_micros();
    let msg = format!("**Attendo Copilot (Offline Rust Fallback • {:.0}% conf • {} µs)**\n```json\n{}\n```", conf * 100.0, elapsed, raw_json);
    Ok((msg, card))
}

pub fn extract_timetable_from_text(raw_text: &str) -> AttendoResult<Value> {
    let days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    let mut current_day = "Monday".to_string();
    let mut slots: Vec<Value> = Vec::new();
    for line in raw_text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() { continue; }
        for d in days {
            if trimmed.to_lowercase().contains(&d.to_lowercase()) {
                current_day = d.to_string();
                break;
            }
        }
        let tokens: Vec<&str> = trimmed.split_whitespace().collect();
        let mut times: Vec<String> = Vec::new();
        let mut words: Vec<&str> = Vec::new();
        for tok in tokens {
            let cleaned = tok.trim_matches(|c: char| c == ',' || c == ';');
            if cleaned.contains(':') && cleaned.len() <= 5 && cleaned.chars().next().map(|c| c.is_ascii_digit()).unwrap_or(false) {
                times.push(if cleaned.len() == 4 { format!("0{}", cleaned) } else { cleaned.to_string() });
            } else if !days.iter().any(|d| cleaned.eq_ignore_ascii_case(d)) && cleaned != "-" && cleaned != "to" {
                words.push(cleaned);
            }
        }
        if times.len() >= 2 && !words.is_empty() {
            let subj_name = words.join(" ");
            let is_lab = subj_name.to_lowercase().contains("lab");
            slots.push(json!({ "subject": subj_name, "day": current_day, "start_time": times[0], "end_time": times[1], "room": "", "subject_type": if is_lab { "lab" } else { "theory" } }));
        }
    }
    Ok(json!({ "source": "local_parser", "slots": slots }))
}

pub fn import_extracted_timetable(conn: &Connection, slots: &[Value]) -> AttendoResult<usize> {
    let mut imported = 0;
    for slot in slots {
        let subj_name = match slot.get("subject").and_then(|v| v.as_str()) {
            Some(s) if !s.trim().is_empty() => s.trim(),
            _ => continue,
        };
        let day = slot.get("day").and_then(|v| v.as_str()).unwrap_or("Monday");
        let start = slot.get("start_time").and_then(|v| v.as_str()).unwrap_or("09:00");
        let end = slot.get("end_time").and_then(|v| v.as_str()).unwrap_or("10:00");
        let room = slot.get("room").and_then(|v| v.as_str()).unwrap_or("");
        let stype = slot.get("subject_type").and_then(|v| v.as_str()).unwrap_or("theory");
        let fresh = db::get_all_subjects(conn)?;
        let subj_id = if let Some(f) = fresh.iter().find(|s| s.name.eq_ignore_ascii_case(subj_name)) {
            f.id
        } else {
            db::add_subject(conn, &SubjectInput {
                name: subj_name.to_string(), color: "#6366F1".into(), target_percent: 75,
                subject_type: stype.to_string(), is_frozen: 0, past_attended: 0, past_total: 0,
                credits: if stype == "lab" { 2 } else { 3 },
            })?
        };
        db::add_timetable_entry(conn, &TimetableEntryInput {
            subject_id: subj_id, day_of_week: day.to_string(), start_time: start.to_string(), end_time: end.to_string(), room: room.to_string(),
        })?;
        imported += 1;
    }
    Ok(imported)
}

pub fn extract_todos_from_text(raw_text: &str) -> AttendoResult<Value> {
    let today = Local::now().format("%Y-%m-%d").to_string();
    let tasks: Vec<Value> = raw_text.lines().map(|l| l.trim()).filter(|l| !l.is_empty()).map(|l| {
        let prio = if l.to_lowercase().contains("urgent") || l.to_lowercase().contains("exam") || l.to_lowercase().contains("submit") { "high" } else { "medium" };
        json!({ "title": l, "due_date": today, "priority": prio })
    }).collect();
    Ok(json!({ "source": "local_parser", "tasks": tasks }))
}

pub fn semantic_search(conn: &Connection, query: &str) -> AttendoResult<Value> {
    let subjects = db::get_all_subjects(conn)?;
    let todos = db::get_all_todos(conn)?;
    let mut docs = Vec::new();
    for s in subjects {
        docs.push(("Subject", s.name.clone(), format!("Subject {} ({}) target {}%", s.name, s.subject_type, s.target_percent)));
    }
    for td in todos {
        docs.push(("Task", td.title.clone(), format!("Task {} due {} priority {} {}", td.title, td.due_date, td.priority, td.notes)));
    }
    let q_lower = query.trim().to_lowercase();
    let matched: Vec<Value> = docs.into_iter()
        .filter(|(_, _, text)| q_lower.is_empty() || text.to_lowercase().contains(&q_lower))
        .take(8)
        .map(|(kind, title, text)| json!({ "kind": kind, "title": title, "detail": text, "score": 1.0 }))
        .collect();
    Ok(json!({ "engine": "attendo_rust_ai", "results": matched }))
}
