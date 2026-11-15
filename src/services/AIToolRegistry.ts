import {format, addDays, parseISO, eachDayOfInterval, isValid, isBefore} from 'date-fns';
import {getAllSubjects} from '../db/queries/subjects';
import {getAllTimetableEntries, getTimetableForDay} from '../db/queries/timetable';
import {
  ensureInstancesForDate,
  getInstancesForDate,
  updateInstanceStatus,
  markEntireDayStatus,
  shiftLectureInstance,
  unshiftLectureInstance,
  getAttendanceStats,
  getOverallAttendanceStats,
} from '../db/queries/lectureInstances';
import {AttendanceStatus} from '../types';

export interface AIActionCardData {
  type: 'shift' | 'mark' | 'consequence_warning' | 'plan';
  title: string;
  description: string;
  details: {
    subject?: string;
    from?: string;
    to?: string;
    impact?: string;
    status?: string;
  };
  actionPayload?: any;
}

export const AI_TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'get_attendance_summary',
      description: 'Get real-time overall student attendance, safe bunks left, and per-subject breakdown with target criteria.',
      parameters: {
        type: 'object',
        properties: {
          target_percent: {
            type: 'number',
            description: 'Target attendance percentage threshold (defaults to 75)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_schedule',
      description: 'Get timetable or scheduled classes for a specific date or relative day (e.g., "today", "tomorrow", "Monday", "Thursday", "2026-11-16").',
      parameters: {
        type: 'object',
        properties: {
          date_or_day: {
            type: 'string',
            description: 'The date or day name (e.g., "today", "tomorrow", "Thursday", "Monday", "2026-11-19").',
          },
        },
        required: ['date_or_day'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_free_slots',
      description: 'Find leisure hours or free timetable gaps on a given weekday or date between standard college hours (09:00 to 17:00).',
      parameters: {
        type: 'object',
        properties: {
          day_of_week_or_date: {
            type: 'string',
            description: 'Weekday name (e.g. "Thursday", "Monday") or relative term ("tomorrow").',
          },
        },
        required: ['day_of_week_or_date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'shift_class',
      description: 'Reschedule or shift a class to another date and time slot. When the user has multiple classes on a day and did not specify which subject, DO NOT call this yet—call get_schedule first and ask the user to clarify!',
      parameters: {
        type: 'object',
        properties: {
          subject_name: {
            type: 'string',
            description: 'Exact or partial name of the subject to shift.',
          },
          current_date_or_day: {
            type: 'string',
            description: 'The current date or relative day of the class to shift (e.g. "tomorrow", "Monday", "2026-11-16").',
          },
          target_date: {
            type: 'string',
            description: 'Target destination date (YYYY-MM-DD or relative like "Thursday", "tomorrow", "2026-11-19").',
          },
          target_start_time: {
            type: 'string',
            description: 'Target start time in HH:MM (24-hour format, e.g. "11:00", "14:00").',
          },
          target_end_time: {
            type: 'string',
            description: 'Optional target end time in HH:MM (defaults to 1 hour after start time).',
          },
          is_permanent: {
            type: 'boolean',
            description: 'Whether to permanently shift this timetable slot for future weeks or just for this one date.',
          },
          reason: {
            type: 'string',
            description: 'Optional note or reason for the shift.',
          },
        },
        required: ['subject_name', 'current_date_or_day', 'target_date', 'target_start_time'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'unshift_class',
      description: 'Revert or unshift a shifted class back to its original timetable slot. Can be given either the original class date/day or the shifted destination date/day.',
      parameters: {
        type: 'object',
        properties: {
          subject_name: {
            type: 'string',
            description: 'Exact or partial name of the subject to unshift.',
          },
          date_or_day: {
            type: 'string',
            description: 'Date or day of the shifted class (e.g. "Monday", "tomorrow", "2026-11-16").',
          },
        },
        required: ['subject_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'simulate_bunk_consequences',
      description: 'Simulate the exact mathematical attendance consequence if the user bunks classes on specific dates or subjects. Returns before vs after attendance percentages, deficit counts, and risk levels.',
      parameters: {
        type: 'object',
        properties: {
          dates_or_relative_days: {
            type: 'array',
            items: {type: 'string'},
            description: 'List of dates or days to simulate skipping (e.g. ["tomorrow"], ["2026-11-16", "2026-11-17"]).',
          },
          subject_name: {
            type: 'string',
            description: 'Optional subject name to filter bunking to a single subject.',
          },
        },
        required: ['dates_or_relative_days'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'mark_attendance',
      description: 'Mark classes on a specific date as present, absent, holiday, or cancelled.',
      parameters: {
        type: 'object',
        properties: {
          date_or_day: {
            type: 'string',
            description: 'Date or relative day (e.g. "today", "tomorrow", "2026-11-16").',
          },
          status: {
            type: 'string',
            enum: ['present', 'absent', 'holiday', 'cancelled'],
            description: 'Attendance status to apply.',
          },
          subject_name: {
            type: 'string',
            description: 'Optional subject name if only marking a specific subject.',
          },
          reason: {
            type: 'string',
            description: 'Optional reason or note.',
          },
        },
        required: ['date_or_day', 'status'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate_future_plan',
      description: 'Calculate long-term attendance roadmap till semester end date (e.g. "classes run till 2026-12-20"): total remaining classes, minimum attendance needed, and maximum bunks allowed to stay above target percentage.',
      parameters: {
        type: 'object',
        properties: {
          end_date: {
            type: 'string',
            description: 'Semester ending date (e.g. "2026-12-20" or month name like "Dec 20").',
          },
          target_percent: {
            type: 'number',
            description: 'Target attendance percentage (defaults to 75).',
          },
        },
        required: ['end_date'],
      },
    },
  },
];

function resolveDateString(input: string): {dateStr: string; dayOfWeek: string} {
  const now = new Date();
  const lower = input.trim().toLowerCase();

  if (lower === 'today') {
    return {dateStr: format(now, 'yyyy-MM-dd'), dayOfWeek: format(now, 'EEEE')};
  }
  if (lower === 'tomorrow') {
    const t = addDays(now, 1);
    return {dateStr: format(t, 'yyyy-MM-dd'), dayOfWeek: format(t, 'EEEE')};
  }
  if (lower === 'day after tomorrow' || lower === '+2') {
    const t = addDays(now, 2);
    return {dateStr: format(t, 'yyyy-MM-dd'), dayOfWeek: format(t, 'EEEE')};
  }

  // Weekday name lookup (e.g. "thursday", "next monday")
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayIndex = weekdays.findIndex(w => lower.includes(w));
  if (dayIndex !== -1) {
    const currentDayIndex = now.getDay();
    let daysAhead = dayIndex - currentDayIndex;
    if (daysAhead <= 0) {
      daysAhead += 7; // next occurrence of this weekday
    }
    const target = addDays(now, daysAhead);
    return {dateStr: format(target, 'yyyy-MM-dd'), dayOfWeek: format(target, 'EEEE')};
  }

  // ISO date parsing
  try {
    const parsed = parseISO(input);
    if (isValid(parsed)) {
      return {dateStr: format(parsed, 'yyyy-MM-dd'), dayOfWeek: format(parsed, 'EEEE')};
    }
  } catch (e) {
    // fallback
  }

  return {dateStr: format(now, 'yyyy-MM-dd'), dayOfWeek: format(now, 'EEEE')};
}

export async function executeAITool(
  name: string,
  args: any,
): Promise<{result: string; actionCard?: AIActionCardData}> {
  try {
    switch (name) {
      case 'get_attendance_summary': {
        const targetPercent = args.target_percent || 75;
        const overall = await getOverallAttendanceStats(targetPercent);
        const subjects = await getAllSubjects();
        const activeSubjects = subjects.filter(s => !s.is_frozen);

        const subjectsData = await Promise.all(
          activeSubjects.map(async s => {
            const stats = await getAttendanceStats(s.id, s.target_percent || targetPercent);
            return {
              subject: s.name,
              type: s.subject_type || 'theory',
              attended: stats.attended,
              total: stats.total,
              percentage: stats.percent,
              target: s.target_percent || targetPercent,
              safe_bunks: stats.maxBunkable,
              must_attend: stats.neededToTarget,
              status: stats.percent >= (s.target_percent || targetPercent) ? 'SAFE' : 'AT_RISK',
            };
          }),
        );

        const overallAttended = Math.round((overall.totalClasses * overall.totalPercent) / 100);

        return {
          result: JSON.stringify({
            overall_percentage: overall.totalPercent,
            total_attended: overallAttended,
            total_classes: overall.totalClasses,
            overall_safe_bunks: overall.maxBunkable,
            target_threshold: targetPercent,
            is_in_danger: overall.isInDanger,
            subjects: subjectsData,
          }),
        };
      }

      case 'get_schedule': {
        const {dateStr, dayOfWeek} = resolveDateString(args.date_or_day);
        await ensureInstancesForDate(dateStr);
        const instances = await getInstancesForDate(dateStr);

        if (instances.length > 0) {
          const classes = instances.map(inst => ({
            id: inst.id,
            subject: inst.subject?.name || 'Class',
            start_time: inst.start_time,
            end_time: inst.end_time,
            room: inst.room || 'TBA',
            status: inst.status || 'unmarked',
            is_override: inst.is_override === 1,
          }));
          return {
            result: JSON.stringify({
              query: args.date_or_day,
              date: dateStr,
              day_of_week: dayOfWeek,
              class_count: classes.length,
              classes,
            }),
          };
        }

        // Fallback to general timetable
        const timetable = await getTimetableForDay(dayOfWeek);
        const classes = timetable.map(t => ({
          timetable_id: t.id,
          subject: t.subject?.name || 'Class',
          start_time: t.start_time,
          end_time: t.end_time,
          room: t.room || 'TBA',
          status: 'recurring_slot',
        }));

        return {
          result: JSON.stringify({
            query: args.date_or_day,
            date: dateStr,
            day_of_week: dayOfWeek,
            class_count: classes.length,
            classes,
          }),
        };
      }

      case 'find_free_slots': {
        const {dateStr, dayOfWeek} = resolveDateString(args.day_of_week_or_date);
        await ensureInstancesForDate(dateStr);
        let classes = await getInstancesForDate(dateStr);

        let timeslots: Array<{start: number; end: number; start_str: string; end_str: string}> = [];

        if (classes.length > 0) {
          timeslots = classes.map(c => {
            const [sh, sm] = c.start_time.split(':').map(Number);
            const [eh, em] = c.end_time.split(':').map(Number);
            return {
              start: sh * 60 + (sm || 0),
              end: eh * 60 + (em || 0),
              start_str: c.start_time,
              end_str: c.end_time,
            };
          });
        } else {
          const tt = await getTimetableForDay(dayOfWeek);
          timeslots = tt.map(c => {
            const [sh, sm] = c.start_time.split(':').map(Number);
            const [eh, em] = c.end_time.split(':').map(Number);
            return {
              start: sh * 60 + (sm || 0),
              end: eh * 60 + (em || 0),
              start_str: c.start_time,
              end_str: c.end_time,
            };
          });
        }

        timeslots.sort((a, b) => a.start - b.start);

        // Standard college day: 09:00 (540 min) to 17:00 (1020 min)
        const collegeStart = 9 * 60;
        const collegeEnd = 17 * 60;
        const freeSlots: Array<{start_time: string; end_time: string; duration_hours: number}> = [];

        let currentCursor = collegeStart;
        for (const slot of timeslots) {
          if (slot.start > currentCursor) {
            const diffMin = slot.start - currentCursor;
            if (diffMin >= 45) {
              const sh = Math.floor(currentCursor / 60).toString().padStart(2, '0');
              const sm = (currentCursor % 60).toString().padStart(2, '0');
              const eh = Math.floor(slot.start / 60).toString().padStart(2, '0');
              const em = (slot.start % 60).toString().padStart(2, '0');
              freeSlots.push({
                start_time: `${sh}:${sm}`,
                end_time: `${eh}:${em}`,
                duration_hours: Number((diffMin / 60).toFixed(1)),
              });
            }
          }
          currentCursor = Math.max(currentCursor, slot.end);
        }

        if (currentCursor < collegeEnd) {
          const diffMin = collegeEnd - currentCursor;
          if (diffMin >= 45) {
            const sh = Math.floor(currentCursor / 60).toString().padStart(2, '0');
            const sm = (currentCursor % 60).toString().padStart(2, '0');
            freeSlots.push({
              start_time: `${sh}:${sm}`,
              end_time: '17:00',
              duration_hours: Number((diffMin / 60).toFixed(1)),
            });
          }
        }

        return {
          result: JSON.stringify({
            day_of_week: dayOfWeek,
            date: dateStr,
            occupied_classes_count: timeslots.length,
            available_free_slots: freeSlots,
          }),
        };
      }

      case 'shift_class': {
        const {subject_name, current_date_or_day, target_date, target_start_time, target_end_time, is_permanent, reason} = args;

        const {dateStr: sourceDate} = resolveDateString(current_date_or_day);
        const {dateStr: destDate} = resolveDateString(target_date);

        await ensureInstancesForDate(sourceDate);
        const instances = await getInstancesForDate(sourceDate);

        const subLower = subject_name.trim().toLowerCase();
        const matchedInstance = instances.find(inst =>
          inst.subject?.name.toLowerCase().includes(subLower)
        );

        if (!matchedInstance) {
          return {
            result: JSON.stringify({
              success: false,
              error: `Could not find class matching "${subject_name}" on ${sourceDate}. Available classes: ${instances.map(i => i.subject?.name).join(', ')}`,
            }),
          };
        }

        let endTime = target_end_time;
        if (!endTime) {
          const [h, m] = target_start_time.split(':').map(Number);
          endTime = `${(h + 1).toString().padStart(2, '0')}:${(m || 0).toString().padStart(2, '0')}`;
        }

        await shiftLectureInstance(
          matchedInstance.id,
          destDate,
          target_start_time,
          endTime,
          reason || 'Rescheduled via Proxy AI',
          Boolean(is_permanent),
        );

        const actionCard: AIActionCardData = {
          type: 'shift',
          title: '🔄 Class Shift Applied!',
          description: `Successfully shifted ${matchedInstance.subject?.name} from ${sourceDate} to ${destDate}.`,
          details: {
            subject: matchedInstance.subject?.name,
            from: `${sourceDate} (${matchedInstance.start_time})`,
            to: `${destDate} (${target_start_time} - ${endTime})`,
          },
        };

        return {
          result: JSON.stringify({
            success: true,
            message: `Shifted ${matchedInstance.subject?.name} from ${sourceDate} (${matchedInstance.start_time}) to ${destDate} at ${target_start_time} - ${endTime}.`,
            is_permanent: Boolean(is_permanent),
          }),
          actionCard,
        };
      }

      case 'unshift_class': {
        const {subject_name, date_or_day} = args;
        const targetDate = resolveDateString(date_or_day || 'today').dateStr;

        await ensureInstancesForDate(targetDate);
        const instances = await getInstancesForDate(targetDate);

        // Find candidate matching subject
        const query = (subject_name || '').toLowerCase().trim();
        const matched = instances.find(i =>
          (i.subject?.name || '').toLowerCase().includes(query) &&
          (i.status === 'shifted' || i.is_override === 1 || (i.notes && i.notes.toLowerCase().includes('shifted')))
        );

        if (!matched) {
          // Check if there are any shifted classes for this subject in the week
          return {
            result: JSON.stringify({
              error: `Could not find a shifted class matching "${subject_name}" on ${targetDate}.`,
            }),
          };
        }

        await unshiftLectureInstance(matched.id);

        const actionCard: AIActionCardData = {
          type: 'shift',
          title: '↩️ Class Shift Reverted!',
          description: `Successfully unshifted ${matched.subject?.name} back to its original slot.`,
          details: {
            subject: matched.subject?.name,
            from: targetDate,
            status: 'Restored to original schedule',
          },
        };

        return {
          result: JSON.stringify({
            success: true,
            message: `Successfully unshifted ${matched.subject?.name} and restored its original timetable slot.`,
          }),
          actionCard,
        };
      }

      case 'simulate_bunk_consequences': {
        const datesInput = args.dates_or_relative_days || ['tomorrow'];
        const targetPercent = 75;

        const currentOverall = await getOverallAttendanceStats(targetPercent);
        const subjects = await getAllSubjects();
        const activeSubjects = subjects.filter(s => !s.is_frozen);

        let totalClassesSkipped = 0;
        const subjectSkipCounts: Record<number, number> = {};

        for (const d of datesInput) {
          const {dateStr} = resolveDateString(d);
          await ensureInstancesForDate(dateStr);
          const instances = await getInstancesForDate(dateStr);

          for (const inst of instances) {
            if (args.subject_name) {
              if (!inst.subject?.name.toLowerCase().includes(args.subject_name.toLowerCase())) {
                continue;
              }
            }
            totalClassesSkipped += 1;
            subjectSkipCounts[inst.subject_id] = (subjectSkipCounts[inst.subject_id] || 0) + 1;
          }
        }

        const overallAttended = Math.round((currentOverall.totalClasses * currentOverall.totalPercent) / 100);
        const projectedTotal = currentOverall.totalClasses + totalClassesSkipped;
        const projectedAttended = overallAttended;
        const projectedPercent = projectedTotal > 0
          ? Number(((projectedAttended / projectedTotal) * 100).toFixed(1))
          : 100;

        const impactedSubjects = [];
        for (const sub of activeSubjects) {
          const skipped = subjectSkipCounts[sub.id] || 0;
          if (skipped > 0) {
            const stats = await getAttendanceStats(sub.id, sub.target_percent || targetPercent);
            const newTotal = stats.total + skipped;
            const newPercent = newTotal > 0
              ? Number(((stats.attended / newTotal) * 100).toFixed(1))
              : 100;

            impactedSubjects.push({
              subject: sub.name,
              current_percentage: stats.percent,
              projected_percentage: newPercent,
              classes_skipped: skipped,
              drops_below_target: newPercent < (sub.target_percent || targetPercent),
            });
          }
        }

        const isSafe = projectedPercent >= targetPercent;
        const severity = projectedPercent < 70 ? 'CRITICAL' : projectedPercent < 75 ? 'WARNING' : 'SAFE';

        const actionCard: AIActionCardData = {
          type: 'consequence_warning',
          title: isSafe ? '🌴 Safe to Bunk' : '⚠️ Bunk Danger Alert!',
          description: `Bunking ${totalClassesSkipped} class(es) changes attendance from ${currentOverall.totalPercent}% ➔ ${projectedPercent}%.`,
          details: {
            impact: `${currentOverall.totalPercent}% ➔ ${projectedPercent}% (${severity})`,
            status: isSafe ? 'Above 75% target' : 'Falls below 75% threshold!',
          },
        };

        return {
          result: JSON.stringify({
            current_overall_percentage: currentOverall.totalPercent,
            projected_overall_percentage: projectedPercent,
            total_classes_skipped: totalClassesSkipped,
            risk_level: severity,
            is_overall_safe: isSafe,
            impacted_subjects: impactedSubjects,
            advice: isSafe
              ? `You remain above the target at ${projectedPercent}%. Bunking is safe.`
              : `CRITICAL: Skipping these drops your attendance to ${projectedPercent}%. You will be in the detention zone!`,
          }),
          actionCard,
        };
      }

      case 'mark_attendance': {
        const {date_or_day, status, subject_name, reason} = args;
        const {dateStr} = resolveDateString(date_or_day);
        await ensureInstancesForDate(dateStr);
        const instances = await getInstancesForDate(dateStr);

        let markedCount = 0;
        let targetSubjectName = '';

        if (subject_name) {
          const matched = instances.filter(i =>
            i.subject?.name.toLowerCase().includes(subject_name.toLowerCase())
          );
          for (const inst of matched) {
            await updateInstanceStatus(inst.id, status as AttendanceStatus, reason || 'Marked by Proxy AI');
            markedCount++;
            targetSubjectName = inst.subject?.name || subject_name;
          }
        } else {
          await markEntireDayStatus(dateStr, status as AttendanceStatus, reason || 'Marked by Proxy AI');
          markedCount = instances.length;
        }

        const actionCard: AIActionCardData = {
          type: 'mark',
          title: '✅ Attendance Updated',
          description: `Marked ${markedCount} class(es) on ${dateStr} as "${status.toUpperCase()}".`,
          details: {
            subject: targetSubjectName || 'All classes on this day',
            status: status.toUpperCase(),
          },
        };

        return {
          result: JSON.stringify({
            success: true,
            date: dateStr,
            status,
            marked_count: markedCount,
            subject: targetSubjectName || 'All classes',
          }),
          actionCard,
        };
      }

      case 'calculate_future_plan': {
        const {end_date, target_percent = 75} = args;
        const now = new Date();
        const end = parseISO(end_date);

        if (!isValid(end) || isBefore(end, now)) {
          return {
            result: JSON.stringify({
              error: `Invalid end date: "${end_date}". Please provide a valid future date like "2026-12-20".`,
            }),
          };
        }

        const allEntries = await getAllTimetableEntries();
        const days = eachDayOfInterval({start: now, end});

        let remainingClasses = 0;
        for (const day of days) {
          const dayName = format(day, 'EEEE');
          const count = allEntries.filter(e => e.day_of_week === dayName).length;
          remainingClasses += count;
        }

        const currentOverall = await getOverallAttendanceStats(target_percent);
        const currentAttended = Math.round((currentOverall.totalClasses * currentOverall.totalPercent) / 100);
        const finalTotal = currentOverall.totalClasses + remainingClasses;
        const requiredTotalAttended = Math.ceil((finalTotal * target_percent) / 100);
        const neededToAttend = Math.max(0, requiredTotalAttended - currentAttended);
        const maxAllowedBunks = Math.max(0, remainingClasses - neededToAttend);

        return {
          result: JSON.stringify({
            current_attended: currentAttended,
            current_total: currentOverall.totalClasses,
            current_percentage: currentOverall.totalPercent,
            semester_end_date: format(end, 'yyyy-MM-dd'),
            remaining_classes_count: remainingClasses,
            projected_final_classes: finalTotal,
            must_attend_from_now: neededToAttend,
            maximum_bunks_allowed: maxAllowedBunks,
            target_percent,
            strategy_summary: `Till ${format(end, 'MMMM d, yyyy')}, there are ${remainingClasses} classes remaining. To maintain ${target_percent}%, you must attend at least ${neededToAttend} classes. You can safely bunk up to ${maxAllowedBunks} classes!`,
          }),
        };
      }

      default:
        return {result: JSON.stringify({error: `Unknown tool: ${name}`})};
    }
  } catch (err: any) {
    return {result: JSON.stringify({error: err?.message || 'Tool execution error'})};
  }
}
