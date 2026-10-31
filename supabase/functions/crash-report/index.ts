// Supabase Edge Function: crash-report
// Deploy: supabase functions deploy crash-report
//
// Receives crash telemetry from the app's ErrorBoundary and global error handler.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const body = await req.json();
    const { error_message, error_stack, screen_name, app_version, device_info, device_id } = body;

    if (!error_message) {
      return new Response(
        JSON.stringify({ success: false, error: 'error_message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Find user by device_id
    let userId = null;
    if (device_id) {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('device_id', device_id)
        .single();
      userId = user?.id;
    }

    const { error } = await supabase.from('crash_logs').insert({
      user_id: userId,
      error_message: error_message.substring(0, 2000),
      error_stack: error_stack?.substring(0, 5000),
      screen_name,
      app_version: app_version || '7.0.0',
      device_info,
    });

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
