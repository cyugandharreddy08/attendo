use crate::db;
use crate::error::{AttendoError, AttendoResult};
use crate::models::{StudentProfile, UpdateCheckResult};
use crate::sync::{SUPABASE_ANON_KEY, SUPABASE_URL};
use rusqlite::Connection;
use serde_json::{json, Value};

const SETTING_STUDENT_PROFILE: &str = "student_profile_json";

pub fn get_local_student_profile(conn: &Connection) -> AttendoResult<Option<StudentProfile>> {
    if let Some(raw) = db::get_setting(conn, SETTING_STUDENT_PROFILE)? {
        let profile: StudentProfile = serde_json::from_str(&raw)?;
        return Ok(Some(profile));
    }
    Ok(None)
}

pub fn save_local_student_profile(conn: &Connection, profile: &StudentProfile) -> AttendoResult<()> {
    let raw = serde_json::to_string(profile)?;
    db::set_setting(conn, SETTING_STUDENT_PROFILE, &raw)?;
    Ok(())
}

pub fn search_students(query: &str, college: Option<&str>) -> AttendoResult<Vec<StudentProfile>> {
    let mut url = format!(
        "{}/rest/v1/student_profiles?is_public=eq.true&order=overall_percent.desc&limit=30",
        SUPABASE_URL
    );
    if !query.trim().is_empty() {
        let q = query.trim();
        url.push_str(&format!(
            "&or=(full_name.ilike.*{}*,username.ilike.*{}*)",
            q, q
        ));
    }
    if let Some(c) = college {
        if !c.trim().is_empty() {
            url.push_str(&format!("&college=ilike.*{}*", c.trim()));
        }
    }

    let resp = ureq::get(&url)
        .set("apikey", SUPABASE_ANON_KEY)
        .set("Authorization", &format!("Bearer {}", SUPABASE_ANON_KEY))
        .call()
        .map_err(|e| AttendoError::Network(e.to_string()))?;

    let list: Vec<StudentProfile> = resp
        .into_json()
        .map_err(|e| AttendoError::Network(e.to_string()))?;
    Ok(list)
}

pub fn sync_public_profile(conn: &Connection, profile: &StudentProfile) -> AttendoResult<()> {
    save_local_student_profile(conn, profile)?;
    let url = format!("{}/rest/v1/student_profiles", SUPABASE_URL);
    let _ = ureq::post(&url)
        .set("apikey", SUPABASE_ANON_KEY)
        .set("Authorization", &format!("Bearer {}", SUPABASE_ANON_KEY))
        .set("Content-Type", "application/json")
        .set("Prefer", "resolution=merge-duplicates,return=minimal")
        .send_json(serde_json::to_value(profile)?)
        .map_err(|e| AttendoError::Network(e.to_string()))?;
    Ok(())
}

pub fn submit_bug_report(
    conn: &Connection,
    title: &str,
    description: &str,
    category: &str,
    severity: &str,
    steps: Option<&str>,
) -> AttendoResult<i64> {
    let url = format!("{}/functions/v1/report-bug", SUPABASE_URL);
    let body = json!({
        "title": title,
        "description": description,
        "category": category,
        "severity": severity,
        "steps_to_reproduce": steps,
        "app_version": "9.0.0",
    });

    let synced = match ureq::post(&url)
        .set("apikey", SUPABASE_ANON_KEY)
        .set("Authorization", &format!("Bearer {}", SUPABASE_ANON_KEY))
        .set("Content-Type", "application/json")
        .send_json(body)
    {
        Ok(r) if r.status() >= 200 && r.status() < 300 => 1,
        _ => 0,
    };

    db::insert_local_bug(conn, title, description, category, severity, steps, synced)
}

pub fn check_for_github_update(current_code: i32) -> AttendoResult<UpdateCheckResult> {
    let url = "https://api.github.com/repos/cyugandharreddy08/attendo/releases/latest";
    let resp = ureq::get(url)
        .set("User-Agent", "Attendo-Rust-Client/9.0.0")
        .call()
        .map_err(|e| AttendoError::Network(e.to_string()))?;

    let data: Value = resp
        .into_json()
        .map_err(|e| AttendoError::Network(e.to_string()))?;

    let tag = data
        .get("tag_name")
        .and_then(|v| v.as_str())
        .unwrap_or("v9.0.0")
        .trim_start_matches('v')
        .to_string();

    let parts: Vec<i32> = tag.split('.').filter_map(|p| p.parse::<i32>().ok()).collect();
    let latest_code = if parts.len() >= 3 {
        parts[0] * 100 + parts[1] * 10 + parts[2]
    } else {
        900
    };

    let apk_url = data
        .get("assets")
        .and_then(|a| a.as_array())
        .and_then(|arr| {
            arr.iter()
                .find(|item| {
                    item.get("name")
                        .and_then(|n| n.as_str())
                        .map(|n| n.ends_with(".apk"))
                        .unwrap_or(false)
                })
                .and_then(|item| item.get("browser_download_url").and_then(|u| u.as_str()))
        })
        .unwrap_or("https://github.com/cyugandharreddy08/attendo/releases/latest")
        .to_string();

    let notes = data
        .get("body")
        .and_then(|v| v.as_str())
        .unwrap_or("New Attendo update available.")
        .to_string();

    Ok(UpdateCheckResult {
        has_update: latest_code > current_code,
        latest_version: tag,
        latest_code,
        apk_url,
        release_notes: notes,
        is_mandatory: false,
    })
}
