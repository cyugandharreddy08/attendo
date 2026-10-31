// Supabase Edge Function: host-approve
// Deploy: supabase functions deploy host-approve
//
// Authenticated endpoint for the host to approve/reject versions and bug reviews.
// Uses service_role key for admin access.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple host secret for authentication (set in Supabase secrets)
const HOST_SECRET = Deno.env.get('HOST_SECRET') ?? 'attendo-host-2024';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify host authentication
    const authHeader = req.headers.get('x-host-secret');
    if (authHeader !== HOST_SECRET) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const body = await req.json();
    const { action, version_id, queue_id, feedback } = body;

    if (action === 'approve_version' && version_id) {
      // Approve and release a version
      const { error } = await supabase
        .from('app_versions')
        .update({
          status: 'released',
          approved_at: new Date().toISOString(),
          released_at: new Date().toISOString(),
          host_feedback: feedback || 'Approved by host',
        })
        .eq('id', version_id);

      if (error) throw error;

      // Update queue item
      if (queue_id) {
        await supabase
          .from('host_queue')
          .update({ status: 'approved', resolved_at: new Date().toISOString(), host_notes: feedback })
          .eq('id', queue_id);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Version released to all users' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (action === 'reject_version' && version_id) {
      const { error } = await supabase
        .from('app_versions')
        .update({
          status: 'rejected',
          host_feedback: feedback || 'Rejected by host',
        })
        .eq('id', version_id);

      if (error) throw error;

      if (queue_id) {
        await supabase
          .from('host_queue')
          .update({ status: 'rejected', resolved_at: new Date().toISOString(), host_notes: feedback })
          .eq('id', queue_id);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Version rejected' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (action === 'resolve_queue' && queue_id) {
      const { error } = await supabase
        .from('host_queue')
        .update({
          status: body.resolution || 'approved',
          resolved_at: new Date().toISOString(),
          host_notes: feedback,
        })
        .eq('id', queue_id);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, message: 'Queue item resolved' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (action === 'trigger_ai_run') {
      // Manually trigger an AI agent run
      const response = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-agent-run`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ run_type: 'host_requested' }),
        },
      );

      const result = await response.json();
      return new Response(
        JSON.stringify({ success: true, ai_result: result }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid action. Use: approve_version, reject_version, resolve_queue, trigger_ai_run' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
