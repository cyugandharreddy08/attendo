const fs = require('fs');
const { SUPABASE_URL, SUPABASE_ANON_KEY } = require('../src/config/supabase.ts');

function computePayloadChecksum(data) {
  const content = `${data.subjects.length}:${data.timetable.length}:${data.instances.length}:${data.overrides.length}:${data.todos.length}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < content.length; i++) {
    hash ^= content.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

const subjects = [
  {
    credits: 1,
    past_total: 0,
    is_frozen: 0,
    subject_type: "theory",
    name: "Data Communication",
    past_attended: 0,
    target_percent: 75,
    color: "#7C3AED",
    id: 10
  },
  {
    credits: 1,
    past_total: 0,
    is_frozen: 0,
    subject_type: "theory",
    name: "DMS",
    past_attended: 0,
    target_percent: 75,
    color: "#B45309",
    id: 11
  },
  {
    credits: 1,
    past_total: 1,
    is_frozen: 0,
    subject_type: "theory",
    name: "DSPM",
    past_attended: 0,
    target_percent: 75,
    color: "#D97706",
    id: 12
  },
  {
    credits: 1,
    past_total: 2,
    is_frozen: 0,
    subject_type: "theory",
    name: "Intro to Graph Theory",
    past_attended: 0,
    target_percent: 75,
    color: "#7C3AED",
    id: 13
  },
  {
    credits: 1,
    past_total: 2,
    is_frozen: 0,
    subject_type: "theory",
    name: "EM-III",
    past_attended: 0,
    target_percent: 75,
    color: "#0891B2",
    id: 14
  },
  {
    credits: 1,
    past_total: 0,
    is_frozen: 0,
    subject_type: "theory",
    name: "DCLD",
    past_attended: 0,
    target_percent: 75,
    color: "#BE185D",
    id: 15
  },
  {
    credits: 1,
    past_total: 0,
    is_frozen: 0,
    subject_type: "lab",
    name: "DCLD Lab",
    past_attended: 0,
    target_percent: 75,
    color: "#7C3AED",
    id: 16
  },
  {
    credits: 1,
    past_total: 0,
    is_frozen: 0,
    subject_type: "lab",
    name: "DSPM Lab (Group 1)",
    past_attended: 0,
    target_percent: 75,
    color: "#DB2777",
    id: 17
  },
  {
    credits: 1,
    past_total: 0,
    is_frozen: 0,
    subject_type: "lab",
    name: "DSPM Lab (Group 2)",
    past_attended: 0,
    target_percent: 75,
    color: "#0D9488",
    id: 18
  }
];

const timetable = [
  {
    room: "L101",
    end_time: "13:00",
    id: 16,
    start_time: "11:00",
    day_of_week: "Monday",
    subject_id: 10
  },
  {
    room: "L103",
    end_time: "15:00",
    id: 17,
    start_time: "14:00",
    day_of_week: "Monday",
    subject_id: 11
  },
  {
    room: "L104",
    end_time: "17:00",
    id: 18,
    start_time: "15:00",
    day_of_week: "Monday",
    subject_id: 12
  },
  {
    room: "L201",
    end_time: "11:00",
    id: 19,
    start_time: "09:00",
    day_of_week: "Tuesday",
    subject_id: 13
  },
  {
    room: "L201",
    end_time: "12:00",
    id: 20,
    start_time: "11:00",
    day_of_week: "Tuesday",
    subject_id: 14
  },
  {
    room: "L101",
    end_time: "15:00",
    id: 21,
    start_time: "14:00",
    day_of_week: "Tuesday",
    subject_id: 10
  },
  {
    room: "L101",
    end_time: "17:00",
    id: 22,
    start_time: "15:00",
    day_of_week: "Tuesday",
    subject_id: 11
  },
  {
    room: "L202",
    end_time: "11:00",
    id: 23,
    start_time: "09:00",
    day_of_week: "Wednesday",
    subject_id: 12
  },
  {
    room: "L103",
    end_time: "12:00",
    id: 24,
    start_time: "11:00",
    day_of_week: "Wednesday",
    subject_id: 15
  },
  {
    room: "L104",
    end_time: "17:00",
    id: 25,
    start_time: "14:00",
    day_of_week: "Wednesday",
    subject_id: 16
  },
  {
    room: "L202",
    end_time: "11:00",
    id: 26,
    start_time: "09:00",
    day_of_week: "Thursday",
    subject_id: 14
  },
  {
    room: "107",
    end_time: "17:00",
    id: 27,
    start_time: "14:00",
    day_of_week: "Thursday",
    subject_id: 17
  },
  {
    room: "L102",
    end_time: "11:00",
    id: 28,
    start_time: "10:00",
    day_of_week: "Friday",
    subject_id: 15
  },
  {
    room: "L103",
    end_time: "13:00",
    id: 29,
    start_time: "11:00",
    day_of_week: "Friday",
    subject_id: 13
  },
  {
    room: "",
    end_time: "12:00",
    id: 30,
    start_time: "11:00",
    day_of_week: "Monday",
    subject_id: 13
  }
];

const instances = [
  {
    room: "L101",
    notes: "",
    original_timetable_id: 16,
    is_override: 0,
    start_time: "11:00",
    marked_at: null,
    end_time: "13:00",
    status: null,
    id: 16,
    subject_id: 10,
    day_of_week: "Monday",
    date: "2026-08-03"
  },
  {
    room: "L103",
    notes: "",
    original_timetable_id: 17,
    is_override: 0,
    start_time: "14:00",
    marked_at: null,
    end_time: "15:00",
    status: null,
    id: 17,
    subject_id: 11,
    day_of_week: "Monday",
    date: "2026-08-03"
  },
  {
    room: "L104",
    notes: "",
    original_timetable_id: 18,
    is_override: 0,
    start_time: "15:00",
    marked_at: null,
    end_time: "17:00",
    status: null,
    id: 18,
    subject_id: 12,
    day_of_week: "Monday",
    date: "2026-08-03"
  },
  {
    room: "L201",
    notes: "",
    original_timetable_id: 19,
    is_override: 0,
    start_time: "09:00",
    marked_at: "2026-08-04T04:41:12.348Z",
    end_time: "11:00",
    status: "present",
    id: 19,
    subject_id: 13,
    day_of_week: "Tuesday",
    date: "2026-08-04"
  },
  {
    room: "L201",
    notes: "",
    original_timetable_id: 20,
    is_override: 0,
    start_time: "11:00",
    marked_at: "2026-08-04T06:32:17.326Z",
    end_time: "12:00",
    status: "present",
    id: 20,
    subject_id: 14,
    day_of_week: "Tuesday",
    date: "2026-08-04"
  },
  {
    room: "L101",
    notes: "",
    original_timetable_id: 21,
    is_override: 0,
    start_time: "14:00",
    marked_at: "2026-08-04T09:22:37.986Z",
    end_time: "15:00",
    status: "present",
    id: 21,
    subject_id: 10,
    day_of_week: "Tuesday",
    date: "2026-08-04"
  },
  {
    room: "L101",
    notes: "",
    original_timetable_id: 22,
    is_override: 0,
    start_time: "15:00",
    marked_at: "2026-08-04T10:13:31.534Z",
    end_time: "17:00",
    status: "present",
    id: 22,
    subject_id: 11,
    day_of_week: "Tuesday",
    date: "2026-08-04"
  },
  {
    room: "L202",
    notes: "",
    original_timetable_id: 23,
    is_override: 0,
    start_time: "09:00",
    marked_at: "2026-08-05T04:40:29.279Z",
    end_time: "11:00",
    status: "present",
    id: 23,
    subject_id: 12,
    day_of_week: "Wednesday",
    date: "2026-08-05"
  },
  {
    room: "L103",
    notes: "",
    original_timetable_id: 24,
    is_override: 0,
    start_time: "11:00",
    marked_at: "2026-08-05T06:27:34.684Z",
    end_time: "12:00",
    status: "present",
    id: 24,
    subject_id: 15,
    day_of_week: "Wednesday",
    date: "2026-08-05"
  },
  {
    room: "L104",
    notes: "",
    original_timetable_id: 25,
    is_override: 0,
    start_time: "14:00",
    marked_at: "2026-08-05T11:33:08.425Z",
    end_time: "17:00",
    status: "present",
    id: 25,
    subject_id: 16,
    day_of_week: "Wednesday",
    date: "2026-08-05"
  },
  {
    room: "L202",
    notes: "",
    original_timetable_id: 26,
    is_override: 0,
    start_time: "09:00",
    marked_at: "2026-08-06T05:13:35.866Z",
    end_time: "11:00",
    status: "present",
    id: 26,
    subject_id: 14,
    day_of_week: "Thursday",
    date: "2026-08-06"
  },
  {
    room: "107",
    notes: "",
    original_timetable_id: 27,
    is_override: 0,
    start_time: "14:00",
    marked_at: "2026-08-06T11:30:43.508Z",
    end_time: "17:00",
    status: "present",
    id: 27,
    subject_id: 17,
    day_of_week: "Thursday",
    date: "2026-08-06"
  },
  {
    room: "L102",
    notes: "",
    original_timetable_id: 28,
    is_override: 0,
    start_time: "09:00",
    marked_at: "2026-08-07T05:29:11.644Z",
    end_time: "11:00",
    status: "present",
    id: 28,
    subject_id: 15,
    day_of_week: "Friday",
    date: "2026-08-07"
  },
  {
    room: "L103",
    notes: "",
    original_timetable_id: 29,
    is_override: 0,
    start_time: "11:00",
    marked_at: "2026-08-07T07:11:52.905Z",
    end_time: "13:00",
    status: "present",
    id: 29,
    subject_id: 13,
    day_of_week: "Friday",
    date: "2026-08-07"
  },
  {
    room: "L103",
    notes: "",
    original_timetable_id: 24,
    is_override: 1,
    start_time: "12:00",
    marked_at: "2026-08-05T06:32:25.764Z",
    end_time: "13:00",
    status: "present",
    id: 31,
    subject_id: 15,
    day_of_week: "Wednesday",
    date: "2026-08-05"
  },
  {
    room: "L101",
    notes: "",
    original_timetable_id: 16,
    is_override: 0,
    start_time: "11:00",
    marked_at: "2026-08-10T06:52:19.427Z",
    end_time: "13:00",
    status: "present",
    id: 32,
    subject_id: 10,
    day_of_week: "Monday",
    date: "2026-08-10"
  },
  {
    room: "L103",
    notes: "",
    original_timetable_id: 17,
    is_override: 0,
    start_time: "14:00",
    marked_at: "2026-08-10T08:51:59.628Z",
    end_time: "15:00",
    status: "present",
    id: 33,
    subject_id: 11,
    day_of_week: "Monday",
    date: "2026-08-10"
  },
  {
    room: "L104",
    notes: "",
    original_timetable_id: 18,
    is_override: 0,
    start_time: "15:00",
    marked_at: "2026-08-10T11:50:11.459Z",
    end_time: "17:00",
    status: "present",
    id: 34,
    subject_id: 12,
    day_of_week: "Monday",
    date: "2026-08-10"
  },
  {
    room: "L201",
    notes: "",
    original_timetable_id: 19,
    is_override: 0,
    start_time: "09:00",
    marked_at: "2026-08-11T05:27:17.655Z",
    end_time: "11:00",
    status: "present",
    id: 35,
    subject_id: 13,
    day_of_week: "Tuesday",
    date: "2026-08-11"
  },
  {
    room: "L201",
    notes: "",
    original_timetable_id: 20,
    is_override: 0,
    start_time: "11:00",
    marked_at: "2026-08-11T06:25:07.329Z",
    end_time: "12:00",
    status: "present",
    id: 36,
    subject_id: 14,
    day_of_week: "Tuesday",
    date: "2026-08-11"
  },
  {
    room: "L101",
    notes: "",
    original_timetable_id: 21,
    is_override: 0,
    start_time: "14:00",
    marked_at: "2026-08-11T09:32:11.655Z",
    end_time: "15:00",
    status: "cancelled",
    id: 37,
    subject_id: 10,
    day_of_week: "Tuesday",
    date: "2026-08-11"
  },
  {
    room: "L101",
    notes: "",
    original_timetable_id: 22,
    is_override: 0,
    start_time: "15:00",
    marked_at: "2026-08-11T10:30:16.352Z",
    end_time: "17:00",
    status: "present",
    id: 38,
    subject_id: 11,
    day_of_week: "Tuesday",
    date: "2026-08-11"
  },
  {
    room: "L202",
    notes: "",
    original_timetable_id: 23,
    is_override: 0,
    start_time: "09:00",
    marked_at: "2026-08-12T07:51:59.355Z",
    end_time: "11:00",
    status: "cancelled",
    id: 39,
    subject_id: 12,
    day_of_week: "Wednesday",
    date: "2026-08-12"
  },
  {
    room: "L103",
    notes: "",
    original_timetable_id: 24,
    is_override: 0,
    start_time: "11:00",
    marked_at: "2026-08-12T07:52:01.799Z",
    end_time: "12:00",
    status: "cancelled",
    id: 40,
    subject_id: 15,
    day_of_week: "Wednesday",
    date: "2026-08-12"
  },
  {
    room: "L104",
    notes: "",
    original_timetable_id: 25,
    is_override: 0,
    start_time: "14:00",
    marked_at: "2026-08-12T10:39:24.724Z",
    end_time: "17:00",
    status: "present",
    id: 41,
    subject_id: 16,
    day_of_week: "Wednesday",
    date: "2026-08-12"
  },
  {
    room: "L202",
    notes: "",
    original_timetable_id: 26,
    is_override: 0,
    start_time: "09:00",
    marked_at: "2026-08-14T07:40:29.337Z",
    end_time: "11:00",
    status: "present",
    id: 42,
    subject_id: 14,
    day_of_week: "Thursday",
    date: "2026-08-13"
  },
  {
    room: "107",
    notes: "",
    original_timetable_id: 27,
    is_override: 0,
    start_time: "14:00",
    marked_at: "2026-08-14T07:40:32.167Z",
    end_time: "17:00",
    status: "cancelled",
    id: 43,
    subject_id: 17,
    day_of_week: "Thursday",
    date: "2026-08-13"
  },
  {
    room: "L102",
    notes: "",
    original_timetable_id: 28,
    is_override: 0,
    start_time: "10:00",
    marked_at: "2026-08-14T07:40:38.206Z",
    end_time: "11:00",
    status: "cancelled",
    id: 44,
    subject_id: 15,
    day_of_week: "Friday",
    date: "2026-08-14"
  },
  {
    room: "L103",
    notes: "",
    original_timetable_id: 29,
    is_override: 0,
    start_time: "11:00",
    marked_at: "2026-08-14T07:40:39.750Z",
    end_time: "13:00",
    status: "cancelled",
    id: 45,
    subject_id: 13,
    day_of_week: "Friday",
    date: "2026-08-14"
  },
  {
    room: "L101",
    notes: "",
    original_timetable_id: 16,
    is_override: 0,
    start_time: "11:00",
    marked_at: "2026-08-17T04:58:24.923Z",
    end_time: "13:00",
    status: "cancelled",
    id: 46,
    subject_id: 10,
    day_of_week: "Monday",
    date: "2026-08-17"
  },
  {
    room: "L103",
    notes: "",
    original_timetable_id: 17,
    is_override: 0,
    start_time: "14:00",
    marked_at: "2026-08-17T04:58:26.155Z",
    end_time: "15:00",
    status: "cancelled",
    id: 47,
    subject_id: 11,
    day_of_week: "Monday",
    date: "2026-08-17"
  },
  {
    room: "L104",
    notes: "",
    original_timetable_id: 18,
    is_override: 0,
    start_time: "15:00",
    marked_at: "2026-08-17T04:58:27.565Z",
    end_time: "17:00",
    status: "cancelled",
    id: 48,
    subject_id: 12,
    day_of_week: "Monday",
    date: "2026-08-17"
  },
  {
    room: "L201",
    notes: "",
    original_timetable_id: 19,
    is_override: 0,
    start_time: "09:00",
    marked_at: "2026-08-17T16:11:07.989Z",
    end_time: "11:00",
    status: "cancelled",
    id: 49,
    subject_id: 13,
    day_of_week: "Tuesday",
    date: "2026-08-18"
  },
  {
    room: "L201",
    notes: "",
    original_timetable_id: 20,
    is_override: 0,
    start_time: "11:00",
    marked_at: "2026-08-18T06:06:36.730Z",
    end_time: "12:00",
    status: "present",
    id: 50,
    subject_id: 14,
    day_of_week: "Tuesday",
    date: "2026-08-18"
  },
  {
    room: "L101",
    notes: "",
    original_timetable_id: 21,
    is_override: 0,
    start_time: "14:00",
    marked_at: "2026-08-18T08:39:08.015Z",
    end_time: "15:00",
    status: "cancelled",
    id: 51,
    subject_id: 10,
    day_of_week: "Tuesday",
    date: "2026-08-18"
  },
  {
    room: "L101",
    notes: "",
    original_timetable_id: 22,
    is_override: 0,
    start_time: "15:00",
    marked_at: "2026-08-18T08:39:09.392Z",
    end_time: "17:00",
    status: "cancelled",
    id: 52,
    subject_id: 11,
    day_of_week: "Tuesday",
    date: "2026-08-18"
  },
  {
    room: "L202",
    notes: "",
    original_timetable_id: 23,
    is_override: 0,
    start_time: "09:00",
    marked_at: "2026-08-19T05:06:46.241Z",
    end_time: "11:00",
    status: "present",
    id: 53,
    subject_id: 12,
    day_of_week: "Wednesday",
    date: "2026-08-19"
  },
  {
    room: "L103",
    notes: "",
    original_timetable_id: 24,
    is_override: 0,
    start_time: "11:00",
    marked_at: "2026-08-19T04:17:40.411Z",
    end_time: "12:00",
    status: "cancelled",
    id: 54,
    subject_id: 15,
    day_of_week: "Wednesday",
    date: "2026-08-19"
  },
  {
    room: "L104",
    notes: "",
    original_timetable_id: 25,
    is_override: 0,
    start_time: "14:00",
    marked_at: "2026-08-19T04:17:41.566Z",
    end_time: "17:00",
    status: "cancelled",
    id: 55,
    subject_id: 16,
    day_of_week: "Wednesday",
    date: "2026-08-19"
  },
  {
    room: "L202",
    notes: "",
    original_timetable_id: 26,
    is_override: 0,
    start_time: "09:00",
    marked_at: "2026-08-20T04:36:45.144Z",
    end_time: "11:00",
    status: "absent",
    id: 56,
    subject_id: 14,
    day_of_week: "Thursday",
    date: "2026-08-20"
  },
  {
    room: "107",
    notes: "",
    original_timetable_id: 27,
    is_override: 0,
    start_time: "14:00",
    marked_at: "2026-08-20T12:29:13.845Z",
    end_time: "17:00",
    status: "present",
    id: 57,
    subject_id: 17,
    day_of_week: "Thursday",
    date: "2026-08-20"
  },
  {
    room: "L102",
    notes: "",
    original_timetable_id: 28,
    is_override: 0,
    start_time: "10:00",
    marked_at: "2026-08-21T06:49:54.243Z",
    end_time: "11:00",
    status: "present",
    id: 58,
    subject_id: 15,
    day_of_week: "Friday",
    date: "2026-08-21"
  },
  {
    room: "L103",
    notes: "",
    original_timetable_id: 29,
    is_override: 0,
    start_time: "11:00",
    marked_at: "2026-08-21T06:49:55.833Z",
    end_time: "13:00",
    status: "cancelled",
    id: 59,
    subject_id: 13,
    day_of_week: "Friday",
    date: "2026-08-21"
  },
  {
    room: "L101",
    notes: "",
    original_timetable_id: 16,
    is_override: 0,
    start_time: "11:00",
    marked_at: "2026-08-24T04:53:13.218Z",
    end_time: "13:00",
    status: "present",
    id: 60,
    subject_id: 10,
    day_of_week: "Monday",
    date: "2026-08-24"
  },
  {
    room: "L103",
    notes: "",
    original_timetable_id: 17,
    is_override: 0,
    start_time: "14:00",
    marked_at: "2026-08-30T14:07:00.723Z",
    end_time: "15:00",
    status: "cancelled",
    id: 61,
    subject_id: 11,
    day_of_week: "Monday",
    date: "2026-08-24"
  }
];

async function main() {
  const syncCode = "ATND-OLD6-V803"; // memorable and distinct
  const checksum = computePayloadChecksum({
    subjects,
    timetable,
    instances,
    overrides: [],
    todos: []
  });

  const payload = {
    schema_version: 2,
    app_version: "8.0.3",
    exported_at: "2026-11-12T19:56:16.892Z",
    checksum,
    subjects,
    timetable,
    instances,
    overrides: [],
    todos: []
  };

  const record = {
    sync_code: syncCode,
    payload: payload,
    schema_version: 2,
    subjects_count: subjects.length,
    classes_count: instances.length,
    checksum: checksum,
    updated_at: new Date().toISOString()
  };

  console.log(`Uploading vault for code: ${syncCode}...`);
  console.log(`Subjects: ${subjects.length}, Timetable entries: ${timetable.length}, Attendance records: ${instances.length}`);

  const res = await fetch(`${SUPABASE_URL}/rest/v1/account_sync_vaults`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    },
    body: JSON.stringify(record)
  });

  if (!res.ok) {
    const txt = await res.text();
    console.error(`Failed to upload (HTTP ${res.status}):`, txt);
    process.exit(1);
  }

  console.log(`✅ Success! Vault uploaded to Supabase under sync_code: ${syncCode}`);

  // Test retrieval
  console.log('Testing retrieval using same query as Attendo app...');
  const verifyRes = await fetch(
    `${SUPABASE_URL}/rest/v1/account_sync_vaults?sync_code=eq.${encodeURIComponent(syncCode)}&select=*`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const rows = await verifyRes.json();
  if (rows && rows.length > 0) {
    console.log('✅ Retrieval Verified! Found row:');
    console.log(`Sync Code: ${rows[0].sync_code}`);
    console.log(`Subjects Count: ${rows[0].subjects_count}`);
    console.log(`Classes Count: ${rows[0].classes_count}`);
    console.log(`Checksum: ${rows[0].checksum}`);
  } else {
    console.error('❌ Retrieval failed.');
  }
}

main().catch(console.error);
