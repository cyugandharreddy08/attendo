-- ============================================================
-- ATTENDO CLOUD PLATFORM — Safe Idempotent Database Migration
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE 1: Users (device-based anonymous registration)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id TEXT UNIQUE NOT NULL,
  app_version TEXT NOT NULL DEFAULT '7.0.0',
  os_version TEXT,
  device_model TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE 1B: Student Profiles (Phone Auth, Campus Discovery, LeetCode Streaks)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  college TEXT NOT NULL,
  academic_year TEXT NOT NULL, -- '1st Year', '2nd Year', '3rd Year', '4th Year', 'Postgraduate'
  branch TEXT DEFAULT '',
  overall_percent INTEGER DEFAULT 0,
  theory_percent INTEGER DEFAULT 0,
  lab_percent INTEGER DEFAULT 0,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  total_attended_hours NUMERIC DEFAULT 0,
  total_held_hours NUMERIC DEFAULT 0,
  active_days_count INTEGER DEFAULT 0,
  activity_matrix JSONB DEFAULT '[]', -- Array of { date: 'YYYY-MM-DD', count: number, hours: number, level: 0-4 }
  badges JSONB DEFAULT '[]',
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE 2: Bug Reports from users
-- ============================================================
CREATE TABLE IF NOT EXISTS bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('crash', 'ui', 'data_loss', 'performance', 'feature', 'general')),
  severity TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  screen_name TEXT,
  steps_to_reproduce TEXT,
  screenshot_url TEXT,
  app_version TEXT NOT NULL,
  device_info JSONB,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'ai_reviewed', 'confirmed', 'in_progress', 'fixed', 'duplicate', 'wont_fix')),
  ai_summary TEXT,
  ai_root_cause TEXT,
  ai_fix_suggestion TEXT,
  duplicate_of UUID REFERENCES bug_reports(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE 3: AI Agent Session Logs
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type TEXT NOT NULL DEFAULT 'scheduled'
    CHECK (run_type IN ('scheduled', 'manual', 'host_requested')),
  bugs_analyzed INTEGER NOT NULL DEFAULT 0,
  bugs_confirmed INTEGER NOT NULL DEFAULT 0,
  bugs_duplicate INTEGER NOT NULL DEFAULT 0,
  gemini_model TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
  tokens_used INTEGER NOT NULL DEFAULT 0,
  summary_report TEXT,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed', 'rate_limited')),
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============================================================
-- TABLE 4: App Versions & Release Pipeline
-- ============================================================
CREATE TABLE IF NOT EXISTS app_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_name TEXT NOT NULL,
  version_code INTEGER NOT NULL,
  release_notes TEXT,
  bugs_fixed UUID[] DEFAULT '{}',
  apk_url TEXT,
  apk_size_bytes BIGINT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'host_review', 'approved', 'rejected', 'released', 'rolled_back')),
  host_feedback TEXT,
  approved_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE 5: Host Approval Queue
-- ============================================================
CREATE TABLE IF NOT EXISTS host_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type TEXT NOT NULL
    CHECK (item_type IN ('version_approval', 'bug_review', 'ai_report')),
  reference_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'deferred')),
  host_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- ============================================================
-- TABLE 6: Crash/Error Telemetry
-- ============================================================
CREATE TABLE IF NOT EXISTS crash_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  screen_name TEXT,
  app_version TEXT NOT NULL,
  device_info JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE 7: Changelogs (visible to users)
-- ============================================================
CREATE TABLE IF NOT EXISTS changelogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id UUID REFERENCES app_versions(id) ON DELETE SET NULL,
  version_name TEXT NOT NULL,
  entries JSONB NOT NULL DEFAULT '[]',
  published_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES for query performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_created ON bug_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bug_reports_category ON bug_reports(category);
CREATE INDEX IF NOT EXISTS idx_bug_reports_user ON bug_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_crash_logs_created ON crash_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crash_logs_user ON crash_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_app_versions_status ON app_versions(status);
CREATE INDEX IF NOT EXISTS idx_app_versions_code ON app_versions(version_code DESC);
CREATE INDEX IF NOT EXISTS idx_host_queue_status ON host_queue(status);
CREATE INDEX IF NOT EXISTS idx_users_device ON users(device_id);
CREATE INDEX IF NOT EXISTS idx_profiles_college ON profiles(LOWER(college));
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);
CREATE INDEX IF NOT EXISTS idx_profiles_streak ON profiles(current_streak DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_overall_percent ON profiles(overall_percent DESC);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) - Drop existing policies first
-- ============================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bug_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE host_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE crash_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE changelogs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "users_insert" ON users;
DROP POLICY IF EXISTS "users_select" ON users;
DROP POLICY IF EXISTS "users_update" ON users;
DROP POLICY IF EXISTS "bugs_insert" ON bug_reports;
DROP POLICY IF EXISTS "bugs_select" ON bug_reports;
DROP POLICY IF EXISTS "ai_sessions_select" ON ai_sessions;
DROP POLICY IF EXISTS "versions_select" ON app_versions;
DROP POLICY IF EXISTS "queue_select" ON host_queue;
DROP POLICY IF EXISTS "crashes_insert" ON crash_logs;
DROP POLICY IF EXISTS "changelogs_select" ON changelogs;

CREATE POLICY "users_insert" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "users_select" ON users FOR SELECT USING (true);
CREATE POLICY "users_update" ON users FOR UPDATE USING (true);

CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (true);

CREATE POLICY "bugs_insert" ON bug_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "bugs_select" ON bug_reports FOR SELECT USING (true);

CREATE POLICY "ai_sessions_select" ON ai_sessions FOR SELECT USING (true);
CREATE POLICY "ai_sessions_insert" ON ai_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "versions_select" ON app_versions FOR SELECT USING (true);
CREATE POLICY "versions_insert" ON app_versions FOR INSERT WITH CHECK (true);
CREATE POLICY "versions_update" ON app_versions FOR UPDATE USING (true);
CREATE POLICY "queue_select" ON host_queue FOR SELECT USING (true);
CREATE POLICY "queue_insert" ON host_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "queue_update" ON host_queue FOR UPDATE USING (true);
CREATE POLICY "crashes_insert" ON crash_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "changelogs_select" ON changelogs FOR SELECT USING (true);

-- ============================================================
-- FUNCTION: Auto-update updated_at on bug_reports
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bug_reports_updated_at ON bug_reports;
CREATE TRIGGER bug_reports_updated_at
  BEFORE UPDATE ON bug_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
