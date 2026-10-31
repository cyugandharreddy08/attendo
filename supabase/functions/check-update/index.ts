// Supabase Edge Function: check-update
// Deploy: supabase functions deploy check-update
//
// Called by the app on launch to check for approved versions.

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

    const body = await req.json().catch(() => ({}));
    const currentVersionCode = body.version_code ?? 0;

    // Get latest released version
    const { data: latest, error } = await supabase
      .from('app_versions')
      .select('id, version_name, version_code, release_notes, apk_url, apk_size_bytes, released_at')
      .eq('status', 'released')
      .order('version_code', { ascending: false })
      .limit(1)
      .single();

    if (error || !latest) {
      return new Response(
        JSON.stringify({ update_available: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const updateAvailable = latest.version_code > currentVersionCode;

    return new Response(
      JSON.stringify({
        update_available: updateAvailable,
        ...(updateAvailable ? {
          version_name: latest.version_name,
          version_code: latest.version_code,
          release_notes: latest.release_notes,
          apk_url: latest.apk_url,
          apk_size_bytes: latest.apk_size_bytes,
          released_at: latest.released_at,
        } : {}),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ update_available: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
