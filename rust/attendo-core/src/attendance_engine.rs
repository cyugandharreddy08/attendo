use crate::models::{
    AchievementBadge, AttendanceActivityDay, BaseAttendanceMetrics, HeatmapSummary,
    LectureInstance, SimulationResult, SplitAttendanceReport, Subject, SubjectWithMetrics,
};
use chrono::NaiveDate;
use std::collections::BTreeMap;

#[inline]
pub fn round_1_decimal(val: f64) -> f64 {
    (val * 10.0).round() / 10.0
}

/// Calculates duration in decimal hours from "HH:MM" start and end times.
/// Minimum 0.5h if valid positive diff, defaults to 1.0h if missing/invalid.
#[inline]
pub fn parse_duration_hours(start_time: &str, end_time: &str) -> f64 {
    let parse_mins = |t: &str| -> Option<i32> {
        let mut parts = t.trim().split(':');
        let h: i32 = parts.next()?.parse().ok()?;
        let m: i32 = parts.next().unwrap_or("0").parse().ok()?;
        Some(h * 60 + m)
    };

    match (parse_mins(start_time), parse_mins(end_time)) {
        (Some(s), Some(e)) if e > s => {
            let hrs = round_1_decimal((e - s) as f64 / 60.0);
            if hrs < 0.5 { 0.5 } else { hrs }
        }
        _ => 1.0,
    }
}

/// Core mathematical attendance engine.
pub fn compute_attendance_metrics(
    attended_hours: f64,
    conducted_hours: f64,
    absent_hours: Option<f64>,
    holiday_hours: f64,
    cancelled_hours: f64,
    target_percent: i32,
) -> BaseAttendanceMetrics {
    let target_percent = if target_percent <= 0 || target_percent > 100 {
        75
    } else {
        target_percent
    };

    let attended = round_1_decimal(attended_hours.max(0.0));
    let conducted = round_1_decimal(conducted_hours.max(0.0));
    let absent = round_1_decimal(absent_hours.unwrap_or_else(|| (conducted - attended).max(0.0)));
    let holiday = round_1_decimal(holiday_hours.max(0.0));
    let cancelled = round_1_decimal(cancelled_hours.max(0.0));

    if conducted <= 0.0 {
        return BaseAttendanceMetrics {
            attended_hours: 0.0,
            conducted_hours: 0.0,
            absent_hours: 0.0,
            holiday_hours: holiday,
            cancelled_hours: cancelled,
            percent: 0,
            target_percent,
            is_eligible: true,
            max_bunkable_hours: 0,
            needed_consecutive_hours: 0,
            status_message: "No classes conducted yet".to_string(),
        };
    }

    let percent = ((attended / conducted) * 100.0).round().clamp(0.0, 100.0) as i32;
    let target_ratio = target_percent as f64 / 100.0;
    let is_eligible = percent >= target_percent;

    let (max_bunkable_hours, needed_consecutive_hours, status_message) = if is_eligible {
        let bunkable = ((attended / target_ratio) - conducted).floor().max(0.0) as i32;
        let msg = if bunkable > 0 {
            format!(
                "Safe! You can miss {} hr{} safely",
                bunkable,
                if bunkable > 1 { "s" } else { "" }
            )
        } else {
            "On target! Attend next class to stay safe".to_string()
        };
        (bunkable, 0, msg)
    } else {
        let denom = (1.0 - target_ratio).max(0.01);
        let raw_needed = (target_ratio * conducted - attended) / denom;
        let needed = raw_needed.ceil().max(1.0) as i32;
        let msg = format!(
            "Must attend {} consecutive hr{} to reach {}%",
            needed,
            if needed > 1 { "s" } else { "" },
            target_percent
        );
        (0, needed, msg)
    };

    BaseAttendanceMetrics {
        attended_hours: attended,
        conducted_hours: conducted,
        absent_hours: absent,
        holiday_hours: holiday,
        cancelled_hours: cancelled,
        percent,
        target_percent,
        is_eligible,
        max_bunkable_hours,
        needed_consecutive_hours,
        status_message,
    }
}

/// Computes subject-level metrics including mid-semester onboarding past totals.
pub fn compute_subject_metrics(subject: &Subject, instances: &[LectureInstance]) -> SubjectWithMetrics {
    let mut attended_hrs = subject.past_attended as f64;
    let mut conducted_hrs = subject.past_total as f64;
    let mut absent_hrs = (subject.past_total - subject.past_attended).max(0) as f64;
    let mut holiday_hrs = 0.0;
    let mut cancelled_hrs = 0.0;

    let mut total_classes = subject.past_total;
    let mut present_classes = subject.past_attended;
    let mut absent_classes = (subject.past_total - subject.past_attended).max(0);

    for inst in instances {
        if inst.subject_id != subject.id {
            continue;
        }
        let dur = parse_duration_hours(&inst.start_time, &inst.end_time);
        match inst.status.as_deref() {
            Some("present") => {
                attended_hrs += dur;
                conducted_hrs += dur;
                total_classes += 1;
                present_classes += 1;
            }
            Some("absent") => {
                conducted_hrs += dur;
                absent_hrs += dur;
                total_classes += 1;
                absent_classes += 1;
            }
            Some("holiday") => {
                holiday_hrs += dur;
            }
            Some("cancelled") => {
                cancelled_hrs += dur;
            }
            _ => {}
        }
    }

    let metrics = compute_attendance_metrics(
        attended_hrs,
        conducted_hrs,
        Some(absent_hrs),
        holiday_hrs,
        cancelled_hrs,
        subject.target_percent,
    );

    SubjectWithMetrics {
        subject: subject.clone(),
        metrics,
        total_classes,
        present_classes,
        absent_classes,
    }
}

/// Computes global split report (Theory vs Lab vs Overall) in a single pass.
pub fn compute_split_report(
    subjects: &[Subject],
    instances: &[LectureInstance],
    global_target: i32,
) -> SplitAttendanceReport {
    let mut t_att = 0.0;
    let mut t_cond = 0.0;
    let mut t_abs = 0.0;
    let mut t_hol = 0.0;
    let mut t_can = 0.0;

    let mut l_att = 0.0;
    let mut l_cond = 0.0;
    let mut l_abs = 0.0;
    let mut l_hol = 0.0;
    let mut l_can = 0.0;

    let mut total_lecture_count = 0;
    let mut total_present_count = 0;
    let mut total_absent_count = 0;

    for subj in subjects {
        if subj.is_frozen == 1 {
            continue;
        }
        let is_lab = subj.subject_type.eq_ignore_ascii_case("lab");
        let past_abs = (subj.past_total - subj.past_attended).max(0);
        total_lecture_count += subj.past_total;
        total_present_count += subj.past_attended;
        total_absent_count += past_abs;

        if is_lab {
            l_att += subj.past_attended as f64;
            l_cond += subj.past_total as f64;
            l_abs += past_abs as f64;
        } else {
            t_att += subj.past_attended as f64;
            t_cond += subj.past_total as f64;
            t_abs += past_abs as f64;
        }
    }

    for inst in instances {
        if inst.is_frozen == 1 {
            continue;
        }
        let is_lab = inst
            .subject_type
            .as_deref()
            .map(|t| t.eq_ignore_ascii_case("lab"))
            .unwrap_or(false);
        let dur = parse_duration_hours(&inst.start_time, &inst.end_time);

        match inst.status.as_deref() {
            Some("present") => {
                total_lecture_count += 1;
                total_present_count += 1;
                if is_lab {
                    l_att += dur;
                    l_cond += dur;
                } else {
                    t_att += dur;
                    t_cond += dur;
                }
            }
            Some("absent") => {
                total_lecture_count += 1;
                total_absent_count += 1;
                if is_lab {
                    l_cond += dur;
                    l_abs += dur;
                } else {
                    t_cond += dur;
                    t_abs += dur;
                }
            }
            Some("holiday") => {
                if is_lab { l_hol += dur; } else { t_hol += dur; }
            }
            Some("cancelled") => {
                if is_lab { l_can += dur; } else { t_can += dur; }
            }
            _ => {}
        }
    }

    SplitAttendanceReport {
        theory: compute_attendance_metrics(t_att, t_cond, Some(t_abs), t_hol, t_can, global_target),
        lab: compute_attendance_metrics(l_att, l_cond, Some(l_abs), l_hol, l_can, global_target),
        overall: compute_attendance_metrics(
            t_att + l_att,
            t_cond + l_cond,
            Some(t_abs + l_abs),
            t_hol + l_hol,
            t_can + l_can,
            global_target,
        ),
        total_lecture_count,
        total_present_count,
        total_absent_count,
    }
}

pub fn simulate_attendance_outcome(
    current_attended_hours: f64,
    current_conducted_hours: f64,
    additional_attended_hours: f64,
    additional_missed_hours: f64,
    target_percent: i32,
) -> SimulationResult {
    let target = if target_percent <= 0 || target_percent > 100 {
        75
    } else {
        target_percent
    };

    let new_attended = current_attended_hours + additional_attended_hours.max(0.0);
    let new_conducted = current_conducted_hours
        + additional_attended_hours.max(0.0)
        + additional_missed_hours.max(0.0);

    let current_percent = if current_conducted_hours > 0.0 {
        ((current_attended_hours / current_conducted_hours) * 100.0).round() as i32
    } else {
        0
    };

    let projected_percent = if new_conducted > 0.0 {
        ((new_attended / new_conducted) * 100.0).round().clamp(0.0, 100.0) as i32
    } else {
        0
    };

    let diff_percent = projected_percent - current_percent;
    let is_eligible = projected_percent >= target;
    let status_message = if is_eligible {
        format!("Projected {}% — Safe above {}%", projected_percent, target)
    } else {
        format!("Projected {}% — Drops below {}%", projected_percent, target)
    };

    SimulationResult {
        projected_percent,
        projected_attended_hours: round_1_decimal(new_attended),
        projected_conducted_hours: round_1_decimal(new_conducted),
        diff_percent,
        is_eligible,
        status_message,
    }
}

/// Computes LeetCode-style activity heatmap, streaks, and achievement badges.
pub fn compute_heatmap_and_streaks(
    subjects: &[Subject],
    instances: &[LectureInstance],
    overall_percent: i32,
) -> HeatmapSummary {
    let mut by_date: BTreeMap<String, (i32, f64, i32)> = BTreeMap::new(); // (present_count, present_hours, absent_count)
    let mut total_attended_hours = 0.0;
    let mut total_held_hours = 0.0;

    for subj in subjects {
        if subj.is_frozen == 1 { continue; }
        total_attended_hours += subj.past_attended as f64;
        total_held_hours += subj.past_total as f64;
    }

    for inst in instances {
        if inst.is_frozen == 1 { continue; }
        let dur = parse_duration_hours(&inst.start_time, &inst.end_time);
        match inst.status.as_deref() {
            Some("present") => {
                total_attended_hours += dur;
                total_held_hours += dur;
                let entry = by_date.entry(inst.date.clone()).or_insert((0, 0.0, 0));
                entry.0 += 1;
                entry.1 += dur;
            }
            Some("absent") => {
                total_held_hours += dur;
                let entry = by_date.entry(inst.date.clone()).or_insert((0, 0.0, 0));
                entry.2 += 1;
            }
            _ => {}
        }
    }

    let mut days = Vec::with_capacity(by_date.len());
    let mut active_days_count = 0;

    // Streak calculation over sorted dates with activity
    let mut longest_streak = 0;
    let mut running_streak = 0;
    let mut prev_active_date: Option<NaiveDate> = None;

    for (date_str, (present_cnt, present_hrs, absent_cnt)) in &by_date {
        let level: u8 = if *present_cnt == 0 {
            0
        } else if *absent_cnt == 0 && *present_hrs >= 4.0 {
            4
        } else if *absent_cnt == 0 && *present_hrs >= 2.0 {
            3
        } else if *present_cnt >= 2 {
            2
        } else {
            1
        };

        if *present_cnt > 0 {
            active_days_count += 1;
            if let Ok(d) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
                if let Some(prev) = prev_active_date {
                    let gap = (d - prev).num_days();
                    if gap <= 2 {
                        // Allow weekend gap (1-2 days) or consecutive days
                        running_streak += 1;
                    } else {
                        running_streak = 1;
                    }
                } else {
                    running_streak = 1;
                }
                if running_streak > longest_streak {
                    longest_streak = running_streak;
                }
                prev_active_date = Some(d);
            }
        } else if *absent_cnt > 0 {
            running_streak = 0;
            prev_active_date = None;
        }

        days.push(AttendanceActivityDay {
            date: date_str.clone(),
            count: *present_cnt,
            hours: round_1_decimal(*present_hrs),
            level,
        });
    }

    let current_streak = running_streak;
    let badges = compute_badges(
        active_days_count,
        longest_streak,
        overall_percent,
        total_attended_hours,
        subjects.len(),
    );

    HeatmapSummary {
        days,
        current_streak,
        longest_streak,
        active_days_count,
        total_attended_hours: round_1_decimal(total_attended_hours),
        total_held_hours: round_1_decimal(total_held_hours),
        badges,
    }
}

fn compute_badges(
    active_days: i32,
    longest_streak: i32,
    overall_percent: i32,
    total_hours: f64,
    subject_count: usize,
) -> Vec<AchievementBadge> {
    vec![
        AchievementBadge {
            id: "first_step".into(),
            title: "First Step".into(),
            description: "Attended your first tracked class".into(),
            icon: "⚡".into(),
            unlocked: active_days >= 1,
        },
        AchievementBadge {
            id: "week_warrior".into(),
            title: "Week Warrior".into(),
            description: "Maintained a 5-day attendance streak".into(),
            icon: "🔥".into(),
            unlocked: longest_streak >= 5,
        },
        AchievementBadge {
            id: "shield_75".into(),
            title: "75% Shield Bearer".into(),
            description: "Overall attendance is 75% or above".into(),
            icon: "🛡️".into(),
            unlocked: overall_percent >= 75 && active_days >= 1,
        },
        AchievementBadge {
            id: "royalty_90".into(),
            title: "Attendance Royalty".into(),
            description: "Achieved 90%+ overall attendance".into(),
            icon: "👑".into(),
            unlocked: overall_percent >= 90 && active_days >= 3,
        },
        AchievementBadge {
            id: "century_hours".into(),
            title: "50-Hour Scholar".into(),
            description: "Logged 50+ attended lecture hours".into(),
            icon: "🎓".into(),
            unlocked: total_hours >= 50.0,
        },
        AchievementBadge {
            id: "planner_pro".into(),
            title: "Semester Architect".into(),
            description: "Tracking 4 or more subjects".into(),
            icon: "📐".into(),
            unlocked: subject_count >= 4,
        },
    ]
}
