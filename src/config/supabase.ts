// Supabase Configuration
// Project: Attendo (wmwiekdihtwutupvnlxo)
export const SUPABASE_URL = 'https://wmwiekdihtwutupvnlxo.supabase.co';

// IMPORTANT: Use the ANON (public) key here, NOT the service role key!
// Find it in: Supabase Dashboard → Settings → API → Project API keys → anon public
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indtd2lla2RpaHR3dXR1cHZubHhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1NDcxNDcsImV4cCI6MjEwMjEyMzE0N30.SBtZ4Tt12JIcFmeS7_0_-brRFOSUAux2H0ppBIxGfEg';

// Edge Function endpoints
export const EDGE_FUNCTIONS = {
  reportBug: `${SUPABASE_URL}/functions/v1/report-bug`,
  checkUpdate: `${SUPABASE_URL}/functions/v1/check-update`,
  crashReport: `${SUPABASE_URL}/functions/v1/crash-report`,
};

// Gemini API (used by Edge Functions only, never exposed to client)
export const GEMINI_MODEL = 'gemini-2.0-flash';

// App version info
export const APP_VERSION = '8.0.2';
export const APP_VERSION_CODE = 802;
