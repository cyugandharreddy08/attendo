// Supabase Edge Function: ai-agent-run
// Deploy: supabase functions deploy ai-agent-run
// Secrets needed: GEMINI_API_KEY
//
// The AI Agent that runs every 6 hours via pg_cron.
// 1. Fetches all unprocessed bug reports
// 2. Batches them and sends to Gemini for analysis
// 3. Updates bug reports with AI summaries, root causes, fix suggestions
// 4. Detects duplicates
// 5. Creates host queue entries for review
// 6. Logs the session

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const MAX_BUGS_PER_BATCH = 20;
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 60000; // 1 minute

interface BugReport {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  screen_name?: string;
  steps_to_reproduce?: string;
  app_version: string;
}

interface GeminiAnalysis {
  bug_id: string;
  is_genuine_bug: boolean;
  is_duplicate: boolean;
  duplicate_of_title?: string;
  confirmed_severity: string;
  ai_summary: string;
  ai_root_cause: string;
  ai_fix_suggestion: string;
}

async function callGeminiWithBackoff(prompt: string, apiKey: string): Promise<string> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (response.status === 429) {
        // Rate limited — exponential backoff
        const delay = BACKOFF_BASE_MS * Math.pow(2, attempt);
        console.log(`Rate limited. Waiting ${delay / 1000}s before retry ${attempt + 1}/${MAX_RETRIES}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Empty response from Gemini');
      return text;
    } catch (err) {
      if (attempt === MAX_RETRIES - 1) throw err;
      const delay = BACKOFF_BASE_MS * Math.pow(2, attempt);
      console.log(`Error on attempt ${attempt + 1}. Retrying in ${delay / 1000}s...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries exceeded');
}

function buildAnalysisPrompt(bugs: BugReport[]): string {
  const bugList = bugs.map((b, i) => 
    `BUG #${i + 1} (ID: ${b.id}):
  Title: ${b.title}
  Description: ${b.description}
  Category: ${b.category}
  User Severity: ${b.severity}
  Screen: ${b.screen_name || 'unknown'}
  Steps: ${b.steps_to_reproduce || 'not provided'}
  App Version: ${b.app_version}`
  ).join('\n\n');

  return `You are an expert mobile app QA engineer analyzing bug reports for "Attendo", a React Native attendance tracker app for university students.

The app uses:
- React Native 0.73.6 with TypeScript
- SQLite (react-native-sqlite-storage) for local data
- Supabase for cloud features
- @notifee/react-native for notifications
- react-native-reanimated for animations
- @gorhom/bottom-sheet for bottom sheets

Analyze these ${bugs.length} bug reports:

${bugList}

For EACH bug, return a JSON array with objects containing:
{
  "bug_id": "<the bug ID>",
  "is_genuine_bug": true/false,
  "is_duplicate": true/false,
  "duplicate_of_title": "<title of the bug this duplicates, if applicable>",
  "confirmed_severity": "critical|high|medium|low",
  "ai_summary": "<concise 1-2 sentence summary of the issue>",
  "ai_root_cause": "<likely root cause in the codebase, referencing specific files/components if possible>",
  "ai_fix_suggestion": "<specific code-level fix suggestion>"
}

Rules:
- Group exact or near-duplicate reports together
- Escalate severity for data loss or crash bugs
- Be specific about root causes (reference React Native patterns, SQLite queries, etc.)
- For feature requests (category='feature'), set is_genuine_bug=false
- Return ONLY the JSON array, no other text`;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );

  const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) {
    return new Response(
      JSON.stringify({ success: false, error: 'GEMINI_API_KEY not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  // Create AI session log
  const { data: session, error: sessionError } = await supabase
    .from('ai_sessions')
    .insert({ run_type: 'scheduled', status: 'running' })
    .select('id')
    .single();

  if (sessionError || !session) {
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to create AI session' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const sessionId = session.id;

  try {
    // Fetch unprocessed bug reports
    const { data: bugs, error: fetchError } = await supabase
      .from('bug_reports')
      .select('id, title, description, category, severity, screen_name, steps_to_reproduce, app_version')
      .eq('status', 'new')
      .order('created_at', { ascending: true })
      .limit(MAX_BUGS_PER_BATCH * 5); // Max 100 bugs per run

    if (fetchError) throw fetchError;
    if (!bugs || bugs.length === 0) {
      await supabase.from('ai_sessions').update({
        status: 'completed',
        bugs_analyzed: 0,
        summary_report: 'No new bugs to analyze.',
        completed_at: new Date().toISOString(),
      }).eq('id', sessionId);

      return new Response(
        JSON.stringify({ success: true, message: 'No new bugs to analyze' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    let totalAnalyzed = 0;
    let totalConfirmed = 0;
    let totalDuplicate = 0;
    let totalTokens = 0;
    const allSummaries: string[] = [];

    // Process in batches
    for (let i = 0; i < bugs.length; i += MAX_BUGS_PER_BATCH) {
      const batch = bugs.slice(i, i + MAX_BUGS_PER_BATCH);
      const prompt = buildAnalysisPrompt(batch);

      try {
        const responseText = await callGeminiWithBackoff(prompt, geminiApiKey);
        totalTokens += prompt.length + responseText.length; // Rough estimate

        // Parse Gemini response
        let analyses: GeminiAnalysis[];
        try {
          analyses = JSON.parse(responseText);
        } catch {
          // Try to extract JSON from response
          const jsonMatch = responseText.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            analyses = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('Failed to parse Gemini response as JSON');
          }
        }

        // Update each bug report with AI analysis
        for (const analysis of analyses) {
          const updateData: Record<string, unknown> = {
            status: analysis.is_genuine_bug ? 'ai_reviewed' : 'wont_fix',
            ai_summary: analysis.ai_summary,
            ai_root_cause: analysis.ai_root_cause,
            ai_fix_suggestion: analysis.ai_fix_suggestion,
            updated_at: new Date().toISOString(),
          };

          if (analysis.is_duplicate) {
            updateData.status = 'duplicate';
            totalDuplicate++;
          } else if (analysis.is_genuine_bug) {
            totalConfirmed++;
          }

          // Update severity based on AI assessment
          if (analysis.confirmed_severity) {
            updateData.severity = analysis.confirmed_severity;
          }

          await supabase
            .from('bug_reports')
            .update(updateData)
            .eq('id', analysis.bug_id);

          totalAnalyzed++;
        }

        allSummaries.push(`Batch ${Math.floor(i / MAX_BUGS_PER_BATCH) + 1}: Analyzed ${batch.length} bugs`);

        // Small delay between batches to respect rate limits
        if (i + MAX_BUGS_PER_BATCH < bugs.length) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      } catch (batchError) {
        allSummaries.push(`Batch ${Math.floor(i / MAX_BUGS_PER_BATCH) + 1}: FAILED - ${batchError.message}`);
      }
    }

    // Generate summary report
    const summaryReport = `AI Agent Run Complete
Bugs Analyzed: ${totalAnalyzed}
Bugs Confirmed: ${totalConfirmed}
Duplicates Found: ${totalDuplicate}
Estimated Tokens: ${totalTokens}

${allSummaries.join('\n')}`;

    // Update AI session
    await supabase.from('ai_sessions').update({
      status: 'completed',
      bugs_analyzed: totalAnalyzed,
      bugs_confirmed: totalConfirmed,
      bugs_duplicate: totalDuplicate,
      tokens_used: totalTokens,
      summary_report: summaryReport,
      completed_at: new Date().toISOString(),
    }).eq('id', sessionId);

    // Create host queue entry if there are confirmed bugs
    if (totalConfirmed > 0) {
      await supabase.from('host_queue').insert({
        item_type: 'ai_report',
        reference_id: sessionId,
        title: `AI Analysis: ${totalConfirmed} confirmed bugs, ${totalDuplicate} duplicates`,
        description: summaryReport,
        priority: totalConfirmed >= 5 ? 'high' : 'normal',
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        session_id: sessionId,
        bugs_analyzed: totalAnalyzed,
        bugs_confirmed: totalConfirmed,
        bugs_duplicate: totalDuplicate,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    // Log failure
    await supabase.from('ai_sessions').update({
      status: 'failed',
      error_message: err.message,
      completed_at: new Date().toISOString(),
    }).eq('id', sessionId);

    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
