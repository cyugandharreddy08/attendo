use crate::attendance_engine;
use crate::db;
use crate::error::{AttendoError, AttendoResult};
use crate::models::{AIActionCardData, ChatMessage, SubjectInput, TimetableEntryInput};
use crate::needle_ai;
use chrono::{Datelike, Duration, Local, NaiveDate};
use rusqlite::Connection;
use serde_json::{json, Value};

const GROQ_BASE_URL: &str = "https://api.groq.com/openai/v1";
const SEED_BYTES: [u8; 56] = [
    77, 89, 65, 117, 66, 107, 73, 80, 95, 127, 123, 82, 83, 111, 93, 71, 73, 94, 72, 114, 88, 18,
    105, 31, 125, 109, 78, 83, 72, 25, 108, 115, 115, 97, 77, 30, 123, 101, 104, 78, 28, 120, 95,
    127, 94, 97, 110, 101, 98, 98, 91, 108, 68, 29, 125, 76,
];

const SETTING_AI_KEY: &str = "ai_groq_api_key";
const SETTING_AI_MODEL: &str = "ai_selected_model";
const DEFAULT_MODEL: &str = "openai/gpt-oss-120b";

const SYSTEM_PROMPT: &str = r####"You are "Proxy", the student's 24/7 attendance wingman and bunk strategist in the Attendo app.
Your mission: Help college students maximize their free time without ever dropping below their target attendance (usually 75%) or getting debarred.

Key Persona & Guidelines:
1. Collegiate, sharp, encouraging, and witty — talk like that super-smart classmate who has everyone's back.
2. VISUAL FORMATTING & TABLE RULES:
   - Make all responses look clean, structured, and visually impressive on mobile screens.
   - When listing 2 or more classes for any day, ALWAYS format them in a clean 3-column Markdown Table:
     | Time | Subject | Room |
     |---|---|---|
     | 11:00 – 13:00 | Data Communication | L101 |
   - When comparing attendance before vs after bunking, use a concise comparison table:
     | Subject | Current % | If Skipped | Status |
     |---|---|---|---|
   - Use clear section headings with emojis (e.g. "### 📅 Tomorrow's Classes", "### 🌴 Leisure Slots on Thursday", "### ⚠️ Attendance Impact").
   - Use callout blocks (starting with "> ⚠️" or "> 🌴") for important warnings, safe bunk notices, or strategic advice.
3. CRITICAL REASONING & CLARIFICATION RULE:
   - If the user asks to shift or reschedule a class but did NOT specify WHICH subject, call get_schedule & find_free_slots first and ask the user which class to move.
4. BUNK & CONSEQUENCE SIMULATION:
   - When asked "what happens if I bunk tomorrow?", ALWAYS run simulate_bunk_consequences first.
5. FUTURE PLANNING:
   - When asked "classes run till [date], how many can I skip?", call calculate_future_plan."####;

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
                "description": "Get real-time overall student attendance, safe bunks left, and per-subject breakdown.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "target_percent": { "type": "number", "description": "Target attendance percentage (default 75)" }
                    }
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_schedule",
                "description": "Get scheduled classes for a specific date or relative day (today, tomorrow, Monday, etc).",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "date_or_day": { "type": "string" }
                    },
                    "required": ["date_or_day"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "find_free_slots",
                "description": "Find free timetable gaps on a weekday or date between 09:00 and 17:00.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "day_of_week_or_date": { "type": "string" }
                    },
                    "required": ["day_of_week_or_date"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "shift_class",
                "description": "Reschedule or shift a class to another date and time slot.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "subject_name": { "type": "string" },
                        "current_date_or_day": { "type": "string" },
                        "target_date": { "type": "string" },
                        "target_start_time": { "type": "string" },
                        "target_end_time": { "type": "string" },
                        "is_permanent": { "type": "boolean" },
                        "reason": { "type": "string" }
                    },
                    "required": ["subject_name", "current_date_or_day", "target_date", "target_start_time"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "unshift_class",
                "description": "Revert or unshift a shifted class back to its original timetable slot.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "subject_name": { "type": "string" },
                        "date_or_day": { "type": "string" }
                    },
                    "required": ["subject_name"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "simulate_bunk_consequences",
                "description": "Simulate attendance consequence if user bunks classes on specific dates or subjects.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "dates_or_relative_days": { "type": "array", "items": { "type": "string" } },
                        "subject_name": { "type": "string" }
                    },
                    "required": ["dates_or_relative_days"]
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "mark_attendance",
                "description": "Mark classes on a date as present, absent, holiday, or cancelled.",
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
                "name": "calculate_future_plan",
                "description": "Calculate attendance roadmap till semester end date.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "end_date": { "type": "string" },
                        "target_percent": { "type": "number" }
                    },
                    "required": ["end_date"]
                }
            }
        }
    ])
}

fn resolve_date(input: &str) -> (String, String) {
    let today = Local::now().date_naive();
    let lower = input.trim().to_lowercase();

    let target = if lower == "today" || lower.is_empty() {
        today
    } else if lower == "tomorrow" {
        today + Duration::days(1)
    } else if lower == "day after tomorrow" || lower == "+2" {
        today + Duration::days(2)
    } else if let Ok(d) = NaiveDate::parse_from_str(&lower, "%Y-%m-%d") {
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

fn execute_tool(
    conn: &Connection,
    name: &str,
    args: &Value,
) -> (String, Option<AIActionCardData>) {
    match name {
        "get_attendance_summary" => {
            let target = args.get("target_percent").and_then(|v| v.as_i64()).unwrap_or(75) as i32;
            let subjects = db::get_all_subjects(conn).unwrap_or_default();
            let instances = db::get_all_instances(conn).unwrap_or_default();
            let report = attendance_engine::compute_split_report(&subjects, &instances, target);
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
                        "status": m.metrics.status_message,
                    })
                })
                .collect();
            let out = json!({
                "overall": report.overall,
                "theory": report.theory,
                "lab": report.lab,
                "subjects": subj_stats,
            });
            (out.to_string(), None)
        }
        "get_schedule" => {
            let raw = args.get("date_or_day").and_then(|v| v.as_str()).unwrap_or("today");
            let (date_str, day_name) = resolve_date(raw);
            let classes = db::get_instances_for_date(conn, &date_str).unwrap_or_default();
            (
                json!({ "date": date_str, "day": day_name, "classes": classes }).to_string(),
                None,
            )
        }
        "find_free_slots" => {
            let raw = args.get("day_of_week_or_date").and_then(|v| v.as_str()).unwrap_or("today");
            let (date_str, day_name) = resolve_date(raw);
            let classes = db::get_instances_for_date(conn, &date_str).unwrap_or_default();
            let standard_slots = [
                ("09:00", "10:00"),
                ("10:00", "11:00"),
                ("11:00", "12:00"),
                ("12:00", "13:00"),
                ("14:00", "15:00"),
                ("15:00", "16:00"),
                ("16:00", "17:00"),
            ];
            let free: Vec<Value> = standard_slots
                .iter()
                .filter(|(s, _)| !classes.iter().any(|c| c.start_time == *s && c.status.as_deref() != Some("shifted")))
                .map(|(s, e)| json!({ "start_time": s, "end_time": e }))
                .collect();
            (
                json!({ "date": date_str, "day": day_name, "free_slots": free }).to_string(),
                None,
            )
        }
        "shift_class" => {
            let subj_q = args.get("subject_name").and_then(|v| v.as_str()).unwrap_or("").to_lowercase();
            let cur_day = args.get("current_date_or_day").and_then(|v| v.as_str()).unwrap_or("today");
            let tgt_day = args.get("target_date").and_then(|v| v.as_str()).unwrap_or("tomorrow");
            let tgt_start = args.get("target_start_time").and_then(|v| v.as_str()).unwrap_or("14:00");
            let tgt_end = args.get("target_end_time").and_then(|v| v.as_str()).unwrap_or("15:00");
            let is_perm = args.get("is_permanent").and_then(|v| v.as_bool()).unwrap_or(false);
            let reason = args.get("reason").and_then(|v| v.as_str()).unwrap_or("AI Shift");

            let (src_date, _) = resolve_date(cur_day);
            let (dst_date, _) = resolve_date(tgt_day);
            let classes = db::get_instances_for_date(conn, &src_date).unwrap_or_default();
            if let Some(target_inst) = classes.iter().find(|c| {
                c.subject_name.as_deref().unwrap_or("").to_lowercase().contains(&subj_q)
                    && c.status.as_deref() != Some("shifted")
            }) {
                let res = db::shift_lecture_instance(conn, target_inst.id, &dst_date, tgt_start, tgt_end, reason, is_perm);
                if res.is_ok() {
                    let sname = target_inst.subject_name.clone().unwrap_or_else(|| "Class".into());
                    let card = AIActionCardData {
                        card_type: "shift".into(),
                        title: format!("Shifted {}", sname),
                        description: format!("Moved from {} {} to {} {}", src_date, target_inst.start_time, dst_date, tgt_start),
                        details: json!({
                            "subject": sname,
                            "from": format!("{} {}", src_date, target_inst.start_time),
                            "to": format!("{} {}", dst_date, tgt_start),
                            "status": "Shifted"
                        }),
                    };
                    return (json!({ "success": true, "shifted_to": dst_date }).to_string(), Some(card));
                }
            }
            (json!({ "success": false, "error": "Matching class not found on source date" }).to_string(), None)
        }
        "unshift_class" => {
            let subj_q = args.get("subject_name").and_then(|v| v.as_str()).unwrap_or("").to_lowercase();
            let day_q = args.get("date_or_day").and_then(|v| v.as_str()).unwrap_or("today");
            let (date_str, _) = resolve_date(day_q);
            let classes = db::get_instances_for_date(conn, &date_str).unwrap_or_default();
            if let Some(inst) = classes.iter().find(|c| {
                c.subject_name.as_deref().unwrap_or("").to_lowercase().contains(&subj_q)
                    && (c.status.as_deref() == Some("shifted") || c.is_override == 1)
            }) {
                let _ = db::unshift_lecture_instance(conn, inst.id);
                let sname = inst.subject_name.clone().unwrap_or_else(|| "Class".into());
                let card = AIActionCardData {
                    card_type: "shift".into(),
                    title: format!("Unshifted {}", sname),
                    description: "Reverted class back to its original timetable slot".into(),
                    details: json!({ "subject": sname, "status": "Restored" }),
                };
                return (json!({ "success": true }).to_string(), Some(card));
            }
            (json!({ "success": false, "error": "No shifted class found" }).to_string(), None)
        }
        "simulate_bunk_consequences" => {
            let days = args
                .get("dates_or_relative_days")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();
            let subj_filter = args.get("subject_name").and_then(|v| v.as_str()).map(|s| s.to_lowercase());

            let subjects = db::get_all_subjects(conn).unwrap_or_default();
            let instances = db::get_all_instances(conn).unwrap_or_default();
            let current = attendance_engine::compute_split_report(&subjects, &instances, 75);

            let mut missed_hours = 0.0;
            for d_val in days {
                if let Some(d_str) = d_val.as_str() {
                    let (date_str, _) = resolve_date(d_str);
                    let day_classes = db::get_instances_for_date(conn, &date_str).unwrap_or_default();
                    for c in day_classes {
                        if c.status.as_deref() == Some("shifted") || c.is_frozen == 1 {
                            continue;
                        }
                        if let Some(ref f) = subj_filter {
                            if !c.subject_name.as_deref().unwrap_or("").to_lowercase().contains(f) {
                                continue;
                            }
                        }
                        missed_hours += attendance_engine::parse_duration_hours(&c.start_time, &c.end_time);
                    }
                }
            }

            let sim = attendance_engine::simulate_attendance_outcome(
                current.overall.attended_hours,
                current.overall.conducted_hours,
                0.0,
                missed_hours,
                75,
            );
            let card = AIActionCardData {
                card_type: if sim.is_eligible { "plan".into() } else { "consequence_warning".into() },
                title: "Bunk Impact Simulation".into(),
                description: sim.status_message.clone(),
                details: json!({
                    "impact": format!("{}% -> {}% (-{:.1}h)", current.overall.percent, sim.projected_percent, missed_hours),
                    "status": if sim.is_eligible { "SAFE" } else { "DANGER" }
                }),
            };
            (json!({ "before_percent": current.overall.percent, "missed_hours": missed_hours, "simulation": sim }).to_string(), Some(card))
        }
        "mark_attendance" => {
            let day_q = args.get("date_or_day").and_then(|v| v.as_str()).unwrap_or("today");
            let status = args.get("status").and_then(|v| v.as_str()).unwrap_or("present");
            let subj_filter = args.get("subject_name").and_then(|v| v.as_str()).map(|s| s.to_lowercase());
            let (date_str, _) = resolve_date(day_q);

            if let Some(f) = subj_filter {
                let classes = db::get_instances_for_date(conn, &date_str).unwrap_or_default();
                let mut count = 0;
                for c in classes {
                    if c.subject_name.as_deref().unwrap_or("").to_lowercase().contains(&f) {
                        let _ = db::update_instance_status(conn, c.id, Some(status), None);
                        count += 1;
                    }
                }
                let card = AIActionCardData {
                    card_type: "mark".into(),
                    title: format!("Marked {} classes {}", count, status),
                    description: format!("Updated on {}", date_str),
                    details: json!({ "status": status }),
                };
                (json!({ "success": true, "updated": count }).to_string(), Some(card))
            } else {
                let count = db::mark_entire_day_status(conn, &date_str, status).unwrap_or(0);
                let card = AIActionCardData {
                    card_type: "mark".into(),
                    title: format!("Marked {} as {}", date_str, status),
                    description: format!("Updated {} classes", count),
                    details: json!({ "status": status }),
                };
                (json!({ "success": true, "updated": count }).to_string(), Some(card))
            }
        }
        "calculate_future_plan" => {
            let end_raw = args.get("end_date").and_then(|v| v.as_str()).unwrap_or("");
            let target = args.get("target_percent").and_then(|v| v.as_i64()).unwrap_or(75) as i32;
            let (end_date_str, _) = resolve_date(end_raw);
            let today = Local::now().date_naive();
            let end_date = NaiveDate::parse_from_str(&end_date_str, "%Y-%m-%d").unwrap_or(today + Duration::days(30));

            let tt = db::get_all_timetable_entries(conn).unwrap_or_default();
            let subjects = db::get_all_subjects(conn).unwrap_or_default();
            let instances = db::get_all_instances(conn).unwrap_or_default();
            let current = attendance_engine::compute_split_report(&subjects, &instances, target);

            let mut remaining_hours = 0.0;
            let mut cursor = today + Duration::days(1);
            while cursor <= end_date {
                let d_str = cursor.format("%Y-%m-%d").to_string();
                let day_name = db::weekday_name_from_date(&d_str);
                for slot in &tt {
                    if slot.day_of_week.eq_ignore_ascii_case(&day_name) {
                        remaining_hours += attendance_engine::parse_duration_hours(&slot.start_time, &slot.end_time);
                    }
                }
                cursor += Duration::days(1);
            }

            let total_projected_conducted = current.overall.conducted_hours + remaining_hours;
            let required_total_attended = ((target as f64 / 100.0) * total_projected_conducted).ceil();
            let must_attend = (required_total_attended - current.overall.attended_hours).max(0.0);
            let max_skippable = (remaining_hours - must_attend).max(0.0);

            (
                json!({
                    "end_date": end_date.format("%Y-%m-%d").to_string(),
                    "remaining_hours": remaining_hours,
                    "must_attend_hours": must_attend,
                    "max_skippable_hours": max_skippable,
                    "current_percent": current.overall.percent,
                })
                .to_string(),
                None,
            )
        }
        _ => (json!({ "error": "Unknown tool" }).to_string(), None),
    }
}

pub fn send_chat_message(
    conn: &Connection,
    user_prompt: &str,
    history: &[ChatMessage],
) -> AttendoResult<(String, Option<AIActionCardData>)> {
    // 1. Try on-device Needle 3 first for instant, 100% offline tool execution
    if needle_ai::is_needle_ready() {
        let msgs = json!([
            { "role": "system", "content": "You are Proxy, Attendo's local attendance assistant. Pick the exact tool for the user's request." },
            { "role": "user", "content": user_prompt }
        ]);
        let flat_tools: Vec<Value> = tool_definitions()
            .as_array()
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .filter_map(|t| t.get("function").cloned())
            .collect();

        if let Ok(res) = needle_ai::needle_complete(&msgs, Some(&Value::Array(flat_tools)), 256) {
            let confidence = res.get("confidence").and_then(|v| v.as_f64()).unwrap_or(0.0);
            if let Some(calls) = res.get("function_calls").and_then(|v| v.as_array()) {
                if !calls.is_empty() && confidence >= 0.55 {
                    let mut outputs = Vec::new();
                    let mut card_out: Option<AIActionCardData> = None;
                    for c in calls {
                        let fn_name = c.get("name").and_then(|v| v.as_str()).unwrap_or("");
                        let args = c.get("arguments").cloned().unwrap_or(json!({}));
                        let (tool_res, card) = execute_tool(conn, fn_name, &args);
                        if card.is_some() {
                            card_out = card;
                        }
                        outputs.push((fn_name.to_string(), tool_res));
                    }
                    let summary = format_offline_tool_response(&outputs, confidence);
                    return Ok((summary, card_out));
                }
            }
        }
    }

    // 2. Cloud Groq fallback for rich conversational reasoning
    let api_key = get_active_api_key(conn);
    let primary_model = get_active_model(conn);
    let models = [
        primary_model,
        "openai/gpt-oss-20b".to_string(),
        "qwen/qwen3.8-27b".to_string(),
    ];

    let mut base_messages: Vec<Value> = vec![json!({ "role": "system", "content": SYSTEM_PROMPT })];
    let start_idx = history.len().saturating_sub(10);
    for m in &history[start_idx..] {
        base_messages.push(json!({ "role": m.role, "content": m.content }));
    }
    base_messages.push(json!({ "role": "user", "content": user_prompt }));

    let tools = tool_definitions();
    let mut last_err = String::new();

    for model in models {
        let mut messages = base_messages.clone();
        let mut collected_card: Option<AIActionCardData> = None;

        for _turn in 0..4 {
            let body = json!({
                "model": model,
                "messages": messages,
                "tools": tools,
                "tool_choice": "auto",
                "temperature": 0.3,
                "max_tokens": 900,
            });

            let resp = match ureq::post(&format!("{}/chat/completions", GROQ_BASE_URL))
                .set("Authorization", &format!("Bearer {}", api_key))
                .set("Content-Type", "application/json")
                .send_json(body)
            {
                Ok(r) => r,
                Err(e) => {
                    last_err = e.to_string();
                    break;
                }
            };

            let data: Value = match resp.into_json() {
                Ok(v) => v,
                Err(e) => {
                    last_err = e.to_string();
                    break;
                }
            };

            let msg = match data.pointer("/choices/0/message") {
                Some(m) => m,
                None => {
                    last_err = "Empty choices from Groq".into();
                    break;
                }
            };

            if let Some(tool_calls) = msg.get("tool_calls").and_then(|v| v.as_array()) {
                if !tool_calls.is_empty() {
                    messages.push(json!({
                        "role": "assistant",
                        "content": msg.get("content").cloned().unwrap_or(Value::Null),
                        "tool_calls": tool_calls,
                    }));

                    for tc in tool_calls {
                        let tc_id = tc.get("id").and_then(|v| v.as_str()).unwrap_or("");
                        let fn_name = tc.pointer("/function/name").and_then(|v| v.as_str()).unwrap_or("");
                        let raw_args = tc.pointer("/function/arguments").and_then(|v| v.as_str()).unwrap_or("{}");
                        let parsed_args: Value = serde_json::from_str(raw_args).unwrap_or(json!({}));

                        let (result_str, card) = execute_tool(conn, fn_name, &parsed_args);
                        if card.is_some() {
                            collected_card = card;
                        }

                        messages.push(json!({
                            "role": "tool",
                            "tool_call_id": tc_id,
                            "content": result_str,
                        }));
                    }
                    continue;
                }
            }

            if let Some(content) = msg.get("content").and_then(|v| v.as_str()) {
                return Ok((content.to_string(), collected_card));
            }
        }
    }

    Err(AttendoError::Network(format!(
        "Proxy AI unreachable: {}",
        last_err
    )))
}

fn format_offline_tool_response(outputs: &[(String, String)], confidence: f64) -> String {
    let mut out = format!(
        "### ⚡ Needle 3 On-Device AI ({:.0}% confidence)\n\n",
        confidence * 100.0
    );
    for (name, raw_json) in outputs {
        let parsed: Value = serde_json::from_str(raw_json).unwrap_or(json!({}));
        match name.as_str() {
            "get_attendance_summary" => {
                if let Some(ov) = parsed.get("overall") {
                    out.push_str(&format!(
                        "> 🛡️ **Overall Attendance**: **{}%** — {}\n\n",
                        ov.get("percent").and_then(|v| v.as_i64()).unwrap_or(0),
                        ov.get("statusMessage").and_then(|v| v.as_str()).unwrap_or("")
                    ));
                }
                if let Some(subjs) = parsed.get("subjects").and_then(|v| v.as_array()) {
                    if !subjs.is_empty() {
                        out.push_str("| Subject | % | Status |\n|---|---|---|\n");
                        for s in subjs {
                            out.push_str(&format!(
                                "| {} | {}% | {} |\n",
                                s.get("name").and_then(|v| v.as_str()).unwrap_or(""),
                                s.get("percent").and_then(|v| v.as_i64()).unwrap_or(0),
                                s.get("status").and_then(|v| v.as_str()).unwrap_or("")
                            ));
                        }
                    }
                }
            }
            "get_schedule" => {
                let date = parsed.get("date").and_then(|v| v.as_str()).unwrap_or("");
                let day = parsed.get("day").and_then(|v| v.as_str()).unwrap_or("");
                out.push_str(&format!("### 📅 {} ({})\n\n", day, date));
                if let Some(classes) = parsed.get("classes").and_then(|v| v.as_array()) {
                    if classes.is_empty() {
                        out.push_str("🌴 No classes scheduled for this day.\n");
                    } else {
                        out.push_str("| Time | Subject | Room |\n|---|---|---|\n");
                        for c in classes {
                            out.push_str(&format!(
                                "| {} – {} | {} | {} |\n",
                                c.get("start_time").and_then(|v| v.as_str()).unwrap_or(""),
                                c.get("end_time").and_then(|v| v.as_str()).unwrap_or(""),
                                c.get("subject_name").and_then(|v| v.as_str()).unwrap_or("Subject"),
                                c.get("room").and_then(|v| v.as_str()).unwrap_or("-")
                            ));
                        }
                    }
                }
            }
            _ => {
                out.push_str(&format!("Executed **{}** locally offline.\n", name));
            }
        }
    }
    out
}

/// Uses Needle 3 (or deterministic local parser fallback) to extract structured timetable slots from messy pasted text.
pub fn extract_timetable_from_text(raw_text: &str) -> AttendoResult<Value> {
    if needle_ai::is_needle_ready() {
        let msgs = json!([
            {
                "role": "system",
                "content": "Extract every class slot from the timetable text using extract_timetable_slots."
            },
            { "role": "user", "content": raw_text }
        ]);
        let tools = json!([{
            "name": "extract_timetable_slots",
            "description": "Extract structured college timetable entries from raw text.",
            "parameters": {
                "type": "object",
                "properties": {
                    "slots": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "subject": { "type": "string" },
                                "day": { "type": "string" },
                                "start_time": { "type": "string" },
                                "end_time": { "type": "string" },
                                "room": { "type": "string" },
                                "subject_type": { "type": "string", "enum": ["theory", "lab"] }
                            },
                            "required": ["subject", "day", "start_time", "end_time"]
                        }
                    }
                },
                "required": ["slots"]
            }
        }]);

        if let Ok(res) = needle_ai::needle_complete(&msgs, Some(&tools), 512) {
            if let Some(calls) = res.get("function_calls").and_then(|v| v.as_array()) {
                if let Some(slots) = calls.first().and_then(|c| c.pointer("/arguments/slots")) {
                    return Ok(json!({ "source": "needle3", "slots": slots }));
                }
            }
        }
    }

    // Fast deterministic line parser fallback (e.g. "Monday 09:00-10:00 Operating Systems LH-1")
    let days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    let mut slots = Vec::new();
    let mut current_day = "Monday".to_string();

    for line in raw_text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() { continue; }
        let lower = trimmed.to_lowercase();
        if let Some(d) = days.iter().find(|&&d| lower.starts_with(d) || lower.contains(d)) {
            let mut ch = d.chars();
            if let Some(first) = ch.next() {
                current_day = first.to_uppercase().to_string() + ch.as_str();
            }
        }
        // Look for HH:MM-HH:MM or HH:MM - HH:MM
        let tokens: Vec<&str> = trimmed.split_whitespace().collect();
        let mut times: Vec<String> = Vec::new();
        let mut words: Vec<&str> = Vec::new();
        for tok in tokens {
            let cleaned = tok.trim_matches(|c: char| c == ',' || c == ';');
            if cleaned.contains(':') && cleaned.len() <= 11 {
                if let Some((a, b)) = cleaned.split_once('-') {
                    times.push(a.trim().to_string());
                    times.push(b.trim().to_string());
                } else {
                    times.push(cleaned.to_string());
                }
            } else if !days.iter().any(|d| cleaned.eq_ignore_ascii_case(d)) && cleaned != "-" && cleaned != "to" {
                words.push(cleaned);
            }
        }
        if times.len() >= 2 && !words.is_empty() {
            let subj_name = words.join(" ");
            let is_lab = subj_name.to_lowercase().contains("lab");
            slots.push(json!({
                "subject": subj_name,
                "day": current_day,
                "start_time": times[0],
                "end_time": times[1],
                "room": "",
                "subject_type": if is_lab { "lab" } else { "theory" }
            }));
        }
    }

    Ok(json!({ "source": "local_parser", "slots": slots }))
}

pub fn import_extracted_timetable(conn: &Connection, slots: &[Value]) -> AttendoResult<usize> {
    let existing = db::get_all_subjects(conn)?;
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

        let subj_id = if let Some(found) = existing.iter().find(|s| s.name.eq_ignore_ascii_case(subj_name)) {
            found.id
        } else {
            // Check fresh DB in case added in earlier iteration
            let fresh = db::get_all_subjects(conn)?;
            if let Some(f2) = fresh.iter().find(|s| s.name.eq_ignore_ascii_case(subj_name)) {
                f2.id
            } else {
                db::add_subject(
                    conn,
                    &SubjectInput {
                        name: subj_name.to_string(),
                        color: "#8B5CF6".into(),
                        target_percent: 75,
                        subject_type: stype.to_string(),
                        is_frozen: 0,
                        past_attended: 0,
                        past_total: 0,
                        credits: if stype == "lab" { 2 } else { 3 },
                    },
                )?
            }
        };

        db::add_timetable_entry(
            conn,
            &TimetableEntryInput {
                subject_id: subj_id,
                day_of_week: day.to_string(),
                start_time: start.to_string(),
                end_time: end.to_string(),
                room: room.to_string(),
            },
        )?;
        imported += 1;
    }

    Ok(imported)
}

/// Uses Needle 3 to extract structured tasks from college notices / announcements offline.
pub fn extract_todos_from_text(raw_text: &str) -> AttendoResult<Value> {
    let today = Local::now().format("%Y-%m-%d").to_string();
    if needle_ai::is_needle_ready() {
        let msgs = json!([
            {
                "role": "system",
                "content": format!("Today is {}. Extract actionable student tasks/deadlines using extract_tasks.", today)
            },
            { "role": "user", "content": raw_text }
        ]);
        let tools = json!([{
            "name": "extract_tasks",
            "description": "Extract tasks and deadlines from a notice or message.",
            "parameters": {
                "type": "object",
                "properties": {
                    "tasks": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "title": { "type": "string" },
                                "due_date": { "type": "string" },
                                "priority": { "type": "string", "enum": ["high", "medium", "low"] }
                            },
                            "required": ["title", "due_date", "priority"]
                        }
                    }
                },
                "required": ["tasks"]
            }
        }]);

        if let Ok(res) = needle_ai::needle_complete(&msgs, Some(&tools), 512) {
            if let Some(calls) = res.get("function_calls").and_then(|v| v.as_array()) {
                if let Some(tasks) = calls.first().and_then(|c| c.pointer("/arguments/tasks")) {
                    return Ok(json!({ "source": "needle3", "tasks": tasks }));
                }
            }
        }
    }

    // Fallback: split sentences into tasks
    let tasks: Vec<Value> = raw_text
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .map(|l| {
            let prio = if l.to_lowercase().contains("urgent") || l.to_lowercase().contains("exam") || l.to_lowercase().contains("submit") {
                "high"
            } else {
                "medium"
            };
            json!({ "title": l, "due_date": today, "priority": prio })
        })
        .collect();
    Ok(json!({ "source": "local_parser", "tasks": tasks }))
}

/// Offline semantic search across subjects, tasks, and notes using Needle 3 embeddings.
pub fn semantic_search(conn: &Connection, query: &str) -> AttendoResult<Value> {
    let subjects = db::get_all_subjects(conn)?;
    let todos = db::get_all_todos(conn)?;

    let mut docs: Vec<(String, String, String)> = Vec::new(); // (kind, title, text)
    for s in subjects {
        docs.push((
            "Subject".into(),
            s.name.clone(),
            format!("Subject {} ({}) target {}%", s.name, s.subject_type, s.target_percent),
        ));
    }
    for td in todos {
        docs.push((
            "Task".into(),
            td.title.clone(),
            format!("Task {} due {} priority {} {}", td.title, td.due_date, td.priority, td.notes),
        ));
    }

    if needle_ai::is_needle_ready() {
        if let Ok(q_vec) = needle_ai::needle_embed(query) {
            let mut scored: Vec<(f32, Value)> = Vec::new();
            for (kind, title, text) in &docs {
                if let Ok(d_vec) = needle_ai::needle_embed(text) {
                    let sim = needle_ai::cosine_similarity(&q_vec, &d_vec);
                    scored.push((
                        sim,
                        json!({ "kind": kind, "title": title, "detail": text, "score": sim }),
                    ));
                }
            }
            scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
            let top: Vec<Value> = scored.into_iter().take(8).map(|(_, v)| v).collect();
            return Ok(json!({ "engine": "needle3_embeddings", "results": top }));
        }
    }

    let q_lower = query.trim().to_lowercase();
    let matched: Vec<Value> = docs
        .into_iter()
        .filter(|(_, _, text)| q_lower.is_empty() || text.to_lowercase().contains(&q_lower))
        .take(8)
        .map(|(kind, title, text)| json!({ "kind": kind, "title": title, "detail": text, "score": 1.0 }))
        .collect();
    Ok(json!({ "engine": "keyword", "results": matched }))
}
