// Supabase Edge Function: report-bug
// Deploy: supabase functions deploy report-bug
// 
// Receives a bug report from the Attendo app and inserts it into the database.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const body = await req.json();
    const { title, description, category, severity, screen_name, steps_to_reproduce, screenshot_url, app_version, device_info, device_id } = body;

    // Validate required fields
    if (!title || !description) {
      return new Response(
        JSON.stringify({ success: false, error: 'Title and description are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Find or create user by device_id
    let userId = null;
    if (device_id) {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('device_id', device_id)
        .single();

      if (existingUser) {
        userId = existingUser.id;
        await supabase.from('users').update({
          last_seen_at: new Date().toISOString(),
          app_version: app_version || '7.0.0',
        }).eq('id', userId);
      } else {
        const { data: newUser } = await supabase
          .from('users')
          .insert({
            device_id,
            app_version: app_version || '7.0.0',
            os_version: device_info?.os ? `${device_info.os} ${device_info.version}` : null,
            device_model: device_info?.model || null,
          })
          .select('id')
          .single();
        userId = newUser?.id;
      }
    }

    // Insert bug report
    const { data, error } = await supabase.from('bug_reports').insert({
      user_id: userId,
      title,
      description,
      category: category || 'general',
      severity: severity || 'medium',
      screen_name,
      steps_to_reproduce,
      screenshot_url,
      app_version: app_version || '7.0.0',
      device_info,
    }).select('id').single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, bug_id: data.id }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
