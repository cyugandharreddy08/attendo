use crate::attendance_engine;
use crate::attendo_ai::{self, AttendoIntent, AttendoTransformer};
use crate::cloud_services;
use crate::db;
use crate::error::AttendoResult;
use crate::models::{
    AIActionCardData, ChatMessage, Subject, SubjectInput, TimetableEntryInput, TodoInput,
};
use crate::needle_ai;
use crate::sync;
use chrono::{Datelike, Duration, Local, NaiveDate};
use rusqlite::Connection;
use serde_json::{json, Value};
use std::sync::OnceLock;
use std::time::Instant;

static RUST_AI_MODEL: OnceLock<AttendoTransformer> = OnceLock::new();

fn get_model() -> &'static AttendoTransformer {
    RUST_AI_MODEL.get_or_init(|| {
        attendo_ai::load_embedded_model().unwrap_or_else(|_| AttendoTransformer::new_random(42))
    })
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

fn match_subject<'a>(subjects: &'a [Subject], prompt: &str) -> Option<&'a Subject> {
    let lower = prompt.to_lowercase();
    // Exact or substring match, longest name first
    let mut sorted: Vec<&Subject> = subjects.iter().collect();
    sorted.sort_by(|a, b| b.name.len().cmp(&a.name.len()));
    for s in &sorted {
        let sn = s.name.to_lowercase();
        if lower.contains(&sn) {
            return Some(s);
        }
    }
    // Word overlap / abbreviation match
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
    let lower = prompt.to_lowercase();
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
    if lower.contains("lab") {
        "Lab".into()
    } else {
        "".into()
    }
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

pub fn send_chat_message(
    conn: &mut Connection,
    prompt: &str,
    _history: &[ChatMessage],
) -> AttendoResult<(String, Option<AIActionCardData>)> {
    let t0 = Instant::now();
    let model = get_model();

    // Split compound commands on " and then " / "; " / " & "
    let normalized = prompt
        .replace(" and then ", ";")
        .replace(" then ", ";")
        .replace(" & ", ";");
    let clauses: Vec<&str> = normalized
        .split(';')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .collect();

    if clauses.len() > 1 {
        let mut responses = Vec::new();
        let mut last_card = None;
        for clause in clauses {
            let (resp, card) = execute_single_prompt(conn, model, clause)?;
            responses.push(resp);
            if card.is_some() {
                last_card = card;
            }
        }
        let elapsed_us = t0.elapsed().as_micros();
        let footer = format!("\n\n> ⚡ *Attendo Rust Neural Engine • {} µs*", elapsed_us);
        return Ok((responses.join("\n\n---\n\n") + &footer, last_card));
    }

    let (mut resp, card) = execute_single_prompt(conn, model, prompt)?;
    let elapsed_us = t0.elapsed().as_micros();
    resp.push_str(&format!("\n\n> ⚡ *Attendo Rust Neural Engine • {} µs*", elapsed_us));
    Ok((resp, card))
}

fn execute_single_prompt(
    conn: &mut Connection,
    model: &AttendoTransformer,
    prompt: &str,
) -> AttendoResult<(String, Option<AIActionCardData>)> {
    let (mut intent, conf, _ranked) = model.predict(prompt);
    let lower = prompt.to_lowercase();

    // High-precision safety guardrails on critical DB actions
    if (lower.contains("recover") || lower.contains("restore") || lower.contains("undelete") || lower.contains("bring back") || lower.contains("mistake") || lower.contains("accidentally"))
        && (lower.contains("delet") || lower.contains("remov") || lower.contains("class") || lower.contains("subject") || lower.contains("database") || lower.contains("todo") || lower.contains("task"))
    {
        intent = AttendoIntent::RecoverDeleted;
    } else if lower.contains("undo") && !lower.contains("deleted") {
        intent = AttendoIntent::UndoLastAction;
    } else if lower.contains("show deleted") || lower.contains("recovery vault") || lower.contains("list deleted") {
        intent = AttendoIntent::ListDeleted;
    } else if (lower.starts_with("add subject") || lower.starts_with("create subject") || lower.starts_with("new subject") || lower.starts_with("add new subject"))
        && intent == AttendoIntent::UpdateSubject
    {
        intent = AttendoIntent::AddSubject;
    } else if (lower.starts_with("delete subject") || lower.starts_with("remove subject"))
        && intent == AttendoIntent::UpdateSubject
    {
        intent = AttendoIntent::DeleteSubject;
    }

    let subjects = db::get_all_subjects(conn)?;
    let matched_subj = match_subject(&subjects, prompt);
    let target_pct = db::get_setting(conn, "global_target_percent")?
        .and_then(|s| s.parse::<i32>().ok())
        .unwrap_or(75);

    match intent {
        AttendoIntent::GetAttendanceSummary => {
            let instances = db::get_all_instances(conn)?;
            if let Some(s) = matched_subj {
                let m = attendance_engine::compute_subject_metrics(s, &instances);
                let badge = if m.metrics.is_eligible {
                    format!("🌴 **Safe**: You can bunk **{} hr(s)**", m.metrics.max_bunkable_hours)
                } else {
                    format!("⚠️ **Danger**: Attend **{} consecutive hr(s)**", m.metrics.needed_consecutive_hours)
                };
                let msg = format!(
                    "### 📊 {} ({})\n| Metric | Value |\n|---|---|\n| Attendance | **{}%** ({:.0}/{:.0} hrs) |\n| Target | {}% |\n| Status | {} |",
                    s.name, s.subject_type, m.metrics.percent, m.metrics.attended_hours, m.metrics.conducted_hours, s.target_percent, badge
                );
                return Ok((msg, None));
            }
            let report = attendance_engine::compute_split_report(&subjects, &instances, target_pct);
            let mut rows = String::new();
            for s in subjects.iter().filter(|s| s.is_frozen == 0) {
                let m = attendance_engine::compute_subject_metrics(s, &instances);
                let st = if m.metrics.is_eligible {
                    format!("🟢 Bunk {}", m.metrics.max_bunkable_hours)
                } else {
                    format!("🔴 Need {}", m.metrics.needed_consecutive_hours)
                };
                rows.push_str(&format!("| {} | {}% | {} |\n", s.name, m.metrics.percent, st));
            }
            let msg = format!(
                "### 📊 Attendance Overview (Target {}%)\n- **Overall:** **{}%** ({:.0}/{:.0} hrs)\n- **Theory:** **{}%** • **Lab:** **{}%**\n\n| Subject | % | Status |\n|---|---|---|\n{}",
                target_pct,
                report.overall.percent,
                report.overall.attended_hours,
                report.overall.conducted_hours,
                report.theory.percent,
                report.lab.percent,
                rows
            );
            Ok((msg, None))
        }

        AttendoIntent::GetSchedule => {
            let (date_str, day_name) = resolve_date(prompt);
            let classes = db::get_instances_for_date(conn, &date_str)?;
            if classes.is_empty() {
                return Ok((format!("### 📅 {} ({})\n> 🌴 No classes scheduled! Enjoy your free day.", day_name, date_str), None));
            }
            let mut rows = String::new();
            for c in &classes {
                let name = c.subject_name.as_deref().unwrap_or("Subject");
                let room = if c.room.is_empty() { "—" } else { c.room.as_str() };
                let st = c.status.as_deref().unwrap_or("pending");
                rows.push_str(&format!("| {}–{} | {} ({}) | {} |\n", c.start_time, c.end_time, name, st, room));
            }
            Ok((format!("### 📅 {} ({})\n| Time | Subject | Room |\n|---|---|---|\n{}", day_name, date_str, rows), None))
        }

        AttendoIntent::FindFreeSlots => {
            let (date_str, day_name) = resolve_date(prompt);
            let classes = db::get_instances_for_date(conn, &date_str)?;
            let standard = [
                ("09:00", "10:00"),
                ("10:00", "11:00"),
                ("11:00", "12:00"),
                ("12:00", "13:00"),
                ("14:00", "15:00"),
                ("15:00", "16:00"),
                ("16:00", "17:00"),
            ];
            let free: Vec<String> = standard
                .iter()
                .filter(|(s, _)| !classes.iter().any(|c| c.start_time == *s && c.status.as_deref() != Some("shifted")))
                .map(|(s, e)| format!("• **{} – {}**", s, e))
                .collect();
            let body = if free.is_empty() {
                "No free slots between 09:00 and 17:00.".into()
            } else {
                free.join("\n")
            };
            Ok((format!("### 🌴 Free Slots on {} ({})\n{}", day_name, date_str, body), None))
        }

        AttendoIntent::MarkAttendance => {
            let status = if lower.contains("absent") || lower.contains("bunk") || lower.contains("miss") {
                "absent"
            } else if lower.contains("holiday") {
                "holiday"
            } else if lower.contains("cancel") {
                "cancelled"
            } else {
                "present"
            };
            let (date_str, day_name) = resolve_date(prompt);
            let classes = db::get_instances_for_date(conn, &date_str)?;

            if let Some(s) = matched_subj {
                let mut count = 0;
                for c in classes.iter().filter(|c| c.subject_id == s.id) {
                    db::update_instance_status(conn, c.id, Some(status), Some("Marked by Attendo AI"))?;
                    count += 1;
                }
                if count == 0 {
                    return Ok((format!("No **{}** class found on {} ({}).", s.name, day_name, date_str), None));
                }
                let card = AIActionCardData {
                    card_type: "mark_attendance".into(),
                    title: format!("Marked {} {}", s.name, status.to_uppercase()),
                    description: format!("{} ({}) • {} slot(s) updated", day_name, date_str, count),
                    details: json!({ "subject": s.name, "status": status, "date": date_str }),
                };
                return Ok((format!("✅ Marked **{}** as **{}** on **{} ({})**.", s.name, status, day_name, date_str), Some(card)));
            }

            let updated = db::mark_entire_day_status(conn, &date_str, status)?;
            let card = AIActionCardData {
                card_type: "mark_entire_day".into(),
                title: format!("All {} Classes -> {}", day_name, status.to_uppercase()),
                description: format!("Updated {} lecture(s) on {}", updated, date_str),
                details: json!({ "date": date_str, "status": status, "updated": updated }),
            };
            Ok((format!("✅ Marked **{} class(es)** on **{} ({})** as **{}**.", updated, day_name, date_str, status), Some(card)))
        }

        AttendoIntent::AddSubject => {
            let name = extract_new_subject_name(prompt);
            let is_lab = lower.contains("lab");
            let credits = extract_number_near(prompt, &["credit", "credits"]).unwrap_or(if is_lab { 2 } else { 3 });
            let tgt = extract_number_near(prompt, &["target", "%", "percent"]).unwrap_or(target_pct);
            let palette = ["#6366F1", "#22D3EE", "#10B981", "#F59E0B", "#A855F7", "#F43F5E"];
            let color = palette[subjects.len() % palette.len()];

            let id = db::add_subject(
                conn,
                &SubjectInput {
                    name: name.clone(),
                    color: color.into(),
                    target_percent: tgt.clamp(1, 100),
                    subject_type: if is_lab { "lab".into() } else { "theory".into() },
                    is_frozen: 0,
                    past_attended: 0,
                    past_total: 0,
                    credits: credits.clamp(1, 10),
                },
            )?;
            let card = AIActionCardData {
                card_type: "add_subject".into(),
                title: format!("Added Subject: {}", name),
                description: format!("{} • {} credits • {}% target", if is_lab { "Lab" } else { "Theory" }, credits, tgt),
                details: json!({ "id": id, "name": name }),
            };
            Ok((format!("📚 Created subject **{}** ({}, {} credits, {}% target).", name, if is_lab { "Lab" } else { "Theory" }, credits, tgt), Some(card)))
        }

        AttendoIntent::UpdateSubject => {
            let s = match matched_subj {
                Some(s) => s,
                None => return Ok(("Which subject would you like to update? Please mention its name.".into(), None)),
            };
            let new_tgt = extract_number_near(prompt, &["target", "%", "percent"]).unwrap_or(s.target_percent);
            let new_credits = extract_number_near(prompt, &["credit", "credits"]).unwrap_or(s.credits);
            let new_frozen = if lower.contains("unfreeze") {
                0
            } else if lower.contains("freeze") {
                1
            } else {
                s.is_frozen
            };
            db::update_subject(
                conn,
                s.id,
                &SubjectInput {
                    name: s.name.clone(),
                    color: s.color.clone(),
                    target_percent: new_tgt.clamp(1, 100),
                    subject_type: s.subject_type.clone(),
                    is_frozen: new_frozen,
                    past_attended: s.past_attended,
                    past_total: s.past_total,
                    credits: new_credits.clamp(1, 10),
                },
            )?;
            let card = AIActionCardData {
                card_type: "update_subject".into(),
                title: format!("Updated {}", s.name),
                description: format!("Target {}% • {} credits • {}", new_tgt, new_credits, if new_frozen == 1 { "Frozen" } else { "Active" }),
                details: json!({ "id": s.id }),
            };
            Ok((format!("✏️ Updated **{}** — Target: **{}%**, Credits: **{}**, Status: **{}**.", s.name, new_tgt, new_credits, if new_frozen == 1 { "Frozen" } else { "Active" }), Some(card)))
        }

        AttendoIntent::DeleteSubject => {
            let s = match matched_subj {
                Some(s) => s,
                None => return Ok(("Which subject should I delete? Please include the subject name.".into(), None)),
            };
            db::delete_subject(conn, s.id)?;
            let card = AIActionCardData {
                card_type: "delete_subject".into(),
                title: format!("Deleted {}", s.name),
                description: "Archived safely in Recovery Vault — ask me anytime to restore it!".into(),
                details: json!({ "name": s.name }),
            };
            Ok((format!("🗑️ Deleted **{}** (safely backed up in the Recovery Vault — just say *\"recover {}\"* if you ever want it back).", s.name, s.name), Some(card)))
        }

        AttendoIntent::AddTimetableSlot => {
            let s = match matched_subj {
                Some(s) => s,
                None => return Ok(("Please specify which subject to schedule in the timetable.".into(), None)),
            };
            let day = extract_weekday(prompt).unwrap_or("Monday");
            let times = extract_times(prompt);
            let start = times.first().cloned().unwrap_or_else(|| "09:00".into());
            let end = times.get(1).cloned().unwrap_or_else(|| {
                let h = start[..2].parse::<u32>().unwrap_or(9) + 1;
                format!("{:02}:{}", h.min(23), &start[3..])
            });
            let room = extract_room(prompt);
            let id = db::add_timetable_entry(
                conn,
                &TimetableEntryInput {
                    subject_id: s.id,
                    day_of_week: day.into(),
                    start_time: start.clone(),
                    end_time: end.clone(),
                    room: room.clone(),
                },
            )?;
            let card = AIActionCardData {
                card_type: "add_timetable".into(),
                title: format!("Scheduled {}", s.name),
                description: format!("{} • {}–{} {}", day, start, end, room),
                details: json!({ "id": id }),
            };
            Ok((format!("🗓️ Added **{}** every **{}** from **{}** to **{}**{}.", s.name, day, start, end, if room.is_empty() { "".into() } else { format!(" in **{}**", room) }), Some(card)))
        }

        AttendoIntent::DeleteTimetableSlot => {
            let entries = db::get_all_timetable_entries(conn)?;
            let day_filter = extract_weekday(prompt);
            let times = extract_times(prompt);
            let target = entries.iter().find(|e| {
                let subj_ok = matched_subj.map(|s| s.id == e.subject_id).unwrap_or(true);
                let day_ok = day_filter.map(|d| e.day_of_week.eq_ignore_ascii_case(d)).unwrap_or(true);
                let time_ok = times.first().map(|t| e.start_time == *t).unwrap_or(true);
                subj_ok && day_ok && time_ok
            });
            if let Some(e) = target {
                db::delete_timetable_entry(conn, e.id)?;
                let name = e.subject_name.as_deref().unwrap_or("Class");
                return Ok((format!("🗑️ Removed **{}** ({} {}–{}) from your timetable. Saved to Recovery Vault!", name, e.day_of_week, e.start_time, e.end_time), None));
            }
            Ok(("Could not find a matching timetable slot to remove.".into(), None))
        }

        AttendoIntent::ShiftClass => {
            let s = match matched_subj {
                Some(s) => s,
                None => return Ok(("Which subject would you like to shift? (e.g. *\"Shift today's OS to tomorrow 2pm\"*)".into(), None)),
            };
            let (src_date, _) = resolve_date("today");
            let (dst_date, dst_day) = resolve_date(prompt);
            let times = extract_times(prompt);
            let start = times.first().cloned().unwrap_or_else(|| "14:00".into());
            let end = times.get(1).cloned().unwrap_or_else(|| {
                let h = start[..2].parse::<u32>().unwrap_or(14) + 1;
                format!("{:02}:{}", h.min(23), &start[3..])
            });
            let classes = db::get_instances_for_date(conn, &src_date)?;
            if let Some(inst) = classes.iter().find(|c| c.subject_id == s.id && c.status.as_deref() != Some("shifted")) {
                db::shift_lecture_instance(conn, inst.id, &dst_date, &start, &end, "Shifted by Attendo AI", false)?;
                let card = AIActionCardData {
                    card_type: "shift_class".into(),
                    title: format!("Shifted {}", s.name),
                    description: format!("Moved to {} ({}) {}–{}", dst_day, dst_date, start, end),
                    details: json!({ "targetDate": dst_date, "start": start }),
                };
                return Ok((format!("🔀 Shifted **{}** to **{} ({})** at **{}–{}**.", s.name, dst_day, dst_date, start, end), Some(card)));
            }
            Ok((format!("No active **{}** class found today to shift.", s.name), None))
        }

        AttendoIntent::UnshiftClass => {
            let instances = db::get_all_instances(conn)?;
            let target = instances.iter().rev().find(|c| {
                c.is_override == 1 && matched_subj.map(|s| s.id == c.subject_id).unwrap_or(true)
            });
            if let Some(inst) = target {
                db::unshift_lecture_instance(conn, inst.id)?;
                return Ok((format!("↩️ Reverted shifted **{}** back to its original timetable slot.", inst.subject_name.as_deref().unwrap_or("class")), None));
            }
            Ok(("No shifted class found to revert.".into(), None))
        }

        AttendoIntent::SimulateBunk => {
            let (date_str, day_name) = resolve_date(if lower.contains("tomorrow") { "tomorrow" } else { prompt });
            let day_classes = db::get_instances_for_date(conn, &date_str)?;
            let all_instances = db::get_all_instances(conn)?;
            if day_classes.is_empty() {
                return Ok((format!("### 🌴 {} ({})\nNo classes scheduled on this day — 0% impact!", day_name, date_str), None));
            }
            let mut rows = String::new();
            for s in subjects.iter().filter(|s| s.is_frozen == 0) {
                if let Some(matched) = matched_subj {
                    if matched.id != s.id {
                        continue;
                    }
                }
                let hrs: f64 = day_classes.iter().filter(|c| c.subject_id == s.id).count() as f64;
                if hrs == 0.0 {
                    continue;
                }
                let m = attendance_engine::compute_subject_metrics(s, &all_instances);
                let sim = attendance_engine::simulate_attendance_outcome(
                    m.metrics.attended_hours,
                    m.metrics.conducted_hours,
                    0.0,
                    hrs,
                    s.target_percent,
                );
                let icon = if sim.is_eligible { "🟢 Safe" } else { "🔴 Danger" };
                rows.push_str(&format!("| {} | {}% | {}% | {} |\n", s.name, m.metrics.percent, sim.projected_percent, icon));
            }
            if rows.is_empty() {
                return Ok(("No matching classes found on that date to simulate.".into(), None));
            }
            Ok((format!("### 🔮 Bunk Impact for {} ({})\n| Subject | Current | If Skipped | Status |\n|---|---|---|---|\n{}", day_name, date_str, rows), None))
        }

        AttendoIntent::FuturePlan => {
            let instances = db::get_all_instances(conn)?;
            let report = attendance_engine::compute_split_report(&subjects, &instances, target_pct);
            let timetable = db::get_all_timetable_entries(conn)?;
            let weekly_classes = timetable.len().max(1) as i32;
            let est_remaining = weekly_classes * 4;
            let proj_total = report.overall.conducted_hours + est_remaining as f64;
            let min_req = (proj_total * (target_pct as f64 / 100.0)).ceil();
            let can_skip = (est_remaining as f64 - (min_req - report.overall.attended_hours).max(0.0)).max(0.0) as i32;
            Ok((
                format!(
                    "### 🗓️ Semester Roadmap (4-Week Projection)\n- **Current Overall:** {}% ({:.0}/{:.0} hrs)\n- **Projected Classes (~4 wks):** {} lectures\n- **Safe Bunks Ahead:** **~{} lectures** while staying above **{}%**",
                    report.overall.percent, report.overall.attended_hours, report.overall.conducted_hours, est_remaining, can_skip, target_pct
                ),
                None,
            ))
        }

        AttendoIntent::AddTodo => {
            let (due_date, _) = resolve_date(prompt);
            let prio = if lower.contains("high") || lower.contains("urgent") {
                "high"
            } else if lower.contains("low") {
                "low"
            } else {
                "medium"
            };
            let title = prompt
                .replace("add task", "")
                .replace("add todo", "")
                .replace("remind me to", "")
                .trim()
                .to_string();
            let clean_title = if title.is_empty() { "New Task".into() } else { title };
            let id = db::add_todo(
                conn,
                &TodoInput {
                    title: clean_title.clone(),
                    subject_id: matched_subj.map(|s| s.id),
                    due_date: due_date.clone(),
                    due_time: None,
                    priority: prio.into(),
                    alarm_minutes_before: 15,
                    notes: "Added by Attendo AI".into(),
                },
            )?;
            let card = AIActionCardData {
                card_type: "add_todo".into(),
                title: format!("Task Added: {}", clean_title),
                description: format!("Due {} • {} priority", due_date, prio),
                details: json!({ "id": id }),
            };
            Ok((format!("📝 Added task **\"{}\"** (due **{}**, **{}** priority).", clean_title, due_date, prio), Some(card)))
        }

        AttendoIntent::ToggleTodo => {
            let todos = db::get_all_todos(conn)?;
            if let Some(td) = todos.iter().find(|t| t.is_completed == 0 && (lower.contains(&t.title.to_lowercase()) || true)) {
                db::toggle_todo(conn, td.id)?;
                return Ok((format!("✅ Marked task **\"{}\"** as completed!", td.title), None));
            }
            Ok(("No pending tasks found to mark complete.".into(), None))
        }

        AttendoIntent::DeleteTodo => {
            let todos = db::get_all_todos(conn)?;
            if let Some(td) = todos.iter().find(|t| lower.contains(&t.title.to_lowercase())).or_else(|| todos.first()) {
                db::delete_todo(conn, td.id)?;
                return Ok((format!("🗑️ Deleted task **\"{}\"** (archived in Recovery Vault).", td.title), None));
            }
            Ok(("No matching task found to delete.".into(), None))
        }

        AttendoIntent::RecoverDeleted => {
            let query_hint = if let Some(s) = matched_subj {
                Some(s.name.clone())
            } else {
                let candidate = extract_new_subject_name(prompt);
                if candidate == "New Subject" { None } else { Some(candidate) }
            };
            match db::find_and_restore_deleted(conn, query_hint.as_deref()) {
                Ok(res) => {
                    let card = AIActionCardData {
                        card_type: "recover_deleted".into(),
                        title: format!("Recovered {}", res.label),
                        description: format!("Restored {} database record(s) intact!", res.restored_items),
                        details: json!(res),
                    };
                    Ok((
                        format!(
                            "### 🛡️ Database Recovery Complete\nRestored **{}** (`{}`) with **{} record(s)** (including timetable slots & attendance history) directly from the SQLite Recovery Vault!",
                            res.label, res.entity_type, res.restored_items
                        ),
                        Some(card),
                    ))
                }
                Err(e) => Ok((format!("ℹ️ {}", e), None)),
            }
        }

        AttendoIntent::ListDeleted => {
            let list = db::list_deleted_records(conn)?;
            if list.is_empty() {
                return Ok(("### 🛡️ Recovery Vault\nYour database Recovery Vault is clean — no deleted items pending.".into(), None));
            }
            let mut rows = String::new();
            for r in list.iter().take(10) {
                rows.push_str(&format!("| #{} | {} | {} |\n", r.id, r.entity_type, r.label));
            }
            Ok((
                format!(
                    "### 🛡️ Database Recovery Vault\n| ID | Type | Item |\n|---|---|---|\n{}\n> 💡 Say **\"recover [name]\"** to restore any item with all its classes!",
                    rows
                ),
                None,
            ))
        }

        AttendoIntent::UndoLastAction => {
            if let Ok(msg) = db::undo_last_attendance_edit(conn) {
                return Ok((format!("↩️ **Undone:** {}", msg), None));
            }
            match db::find_and_restore_deleted(conn, None) {
                Ok(res) => Ok((format!("↩️ **Restored last deleted item:** {} ({} record(s))", res.label, res.restored_items), None)),
                Err(_) => Ok(("Nothing recent to undo or restore.".into(), None)),
            }
        }

        AttendoIntent::AppSystemAction => {
            if lower.contains("target") {
                if let Some(new_tgt) = extract_number_near(prompt, &["target", "%", "percent"]) {
                    let clamped = new_tgt.clamp(50, 99);
                    db::set_setting(conn, "global_target_percent", &clamped.to_string())?;
                    return Ok((format!("🎯 Updated global target attendance to **{}%**.", clamped), None));
                }
            }
            if lower.contains("backup") || lower.contains("sync") {
                let res = sync::backup_to_cloud(conn, None)?;
                return Ok((format!("☁️ **Cloud Backup Complete** • Sync Key: `{}` • {}", res.sync_key, res.message), None));
            }
            if lower.contains("update") {
                let upd = cloud_services::check_for_github_update(1000)?;
                return Ok((
                    if upd.has_update {
                        format!("🚀 Update available: **v{}**!", upd.latest_version)
                    } else {
                        "✅ You are running the latest **Attendo v10.0.0**!".into()
                    },
                    None,
                ));
            }
            Ok((
                format!(
                    "### 🤖 Attendo Copilot (Pure Rust Neural Engine • {:.0}% conf)\nI control **every feature** of Attendo completely offline:\n- **Mark Attendance:** *\"Mark today's OS present\"* or *\"Mark entire day holiday\"*\n- **Subjects & Timetable:** *\"Add DBMS theory 4 credits\"* or *\"Schedule OS Monday 10:00 in LH1\"*\n- **Shift / Bunk / Plan:** *\"What if I bunk tomorrow?\"*, *\"Shift OS to Friday 2pm\"*\n- **Database Recovery:** *\"I accidentally deleted OS, recover it\"* or *\"Show recovery vault\"*\n- **Tasks & Settings:** *\"Add task submit lab tomorrow\"*, *\"Set target to 80%\"*",
                    conf * 100.0
                ),
                None,
            ))
        }
    }
}

/// Uses Needle 3 (or local parser fallback) to extract structured timetable slots from pasted text.
pub fn extract_timetable_from_text(raw_text: &str) -> AttendoResult<Value> {
    if needle_ai::is_needle_ready() {
        let msgs = json!([
            {
                "role": "system",
                "content": "Extract weekly college timetable slots from the user text. Always call save_timetable_slots."
            },
            { "role": "user", "content": raw_text }
        ]);
        let tools = json!([{
            "name": "save_timetable_slots",
            "description": "Save parsed timetable slots.",
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

        if let Ok(res) = needle_ai::needle_complete(&msgs, Some(&tools), 768) {
            if let Some(calls) = res.get("function_calls").and_then(|v| v.as_array()) {
                if let Some(slots) = calls.first().and_then(|c| c.pointer("/arguments/slots")) {
                    return Ok(json!({ "source": "needle3", "slots": slots }));
                }
            }
        }
    }

    let days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    let mut current_day = "Monday".to_string();
    let mut slots: Vec<Value> = Vec::new();

    for line in raw_text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
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
                if cleaned.len() == 4 {
                    times.push(format!("0{}", cleaned));
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
            let fresh = db::get_all_subjects(conn)?;
            if let Some(f2) = fresh.iter().find(|s| s.name.eq_ignore_ascii_case(subj_name)) {
                f2.id
            } else {
                db::add_subject(
                    conn,
                    &SubjectInput {
                        name: subj_name.to_string(),
                        color: "#6366F1".into(),
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

pub fn extract_todos_from_text(raw_text: &str) -> AttendoResult<Value> {
    let today = Local::now().format("%Y-%m-%d").to_string();
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

pub fn semantic_search(conn: &Connection, query: &str) -> AttendoResult<Value> {
    let subjects = db::get_all_subjects(conn)?;
    let todos = db::get_all_todos(conn)?;
    let mut docs: Vec<(String, String, String)> = Vec::new();
    for s in subjects {
        docs.push(("Subject".into(), s.name.clone(), format!("Subject {} ({}) target {}%", s.name, s.subject_type, s.target_percent)));
    }
    for td in todos {
        docs.push(("Task".into(), td.title.clone(), format!("Task {} due {} priority {} {}", td.title, td.due_date, td.priority, td.notes)));
    }
    let q_lower = query.trim().to_lowercase();
    let matched: Vec<Value> = docs
        .into_iter()
        .filter(|(_, _, text)| q_lower.is_empty() || text.to_lowercase().contains(&q_lower))
        .take(8)
        .map(|(kind, title, text)| json!({ "kind": kind, "title": title, "detail": text, "score": 1.0 }))
        .collect();
    Ok(json!({ "engine": "attendo_rust_ai", "results": matched }))
}
