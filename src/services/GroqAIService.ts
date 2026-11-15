import {getActiveAIApiKey, getActiveAIModel, GROQ_BASE_URL, AI_MODELS} from '../config/aiConfig';
import {AI_TOOL_DEFINITIONS, executeAITool, AIActionCardData} from './AIToolRegistry';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  actionCard?: AIActionCardData;
  timestamp: string;
}

const SYSTEM_PROMPT = `You are "Proxy", the student's 24/7 attendance wingman and bunk strategist in the Attendo app.
Your mission: Help college students maximize their free time without ever dropping below their target attendance (usually 75%) or getting debarred.

Key Persona & Guidelines:
1. Collegiate, sharp, encouraging, and witty — talk like that super-smart classmate who has everyone's back.
2. CRITICAL REASONING & CLARIFICATION RULE:
   - If the user asks to shift or reschedule a class (e.g. "shift tomorrow's class to thursday leisure hour") but does NOT specify WHICH subject:
     a) Always call "get_schedule" for the source day first.
     b) Call "find_free_slots" for the target day.
     c) If there are multiple classes on that source day, DO NOT guess or shift blindly! List the classes found and clearly ask the user which one they want to move to the target leisure slot.
3. BUNK & CONSEQUENCE SIMULATION:
   - When asked "what happens if I bunk tomorrow?" or "mark tomorrow all as absent and consequences", ALWAYS run "simulate_bunk_consequences" first.
   - Present the exact impact: Before % ➔ After %, whether it drops below 75%, and how many classes are required to recover.
4. FUTURE PLANNING:
   - When asked "classes run till [date], how many can I skip?", call "calculate_future_plan" and clearly state:
     * Total remaining classes
     * Classes they MUST attend
     * Maximum SAFE bunks allowed.
5. FORMATTING:
   - Use clean Markdown: bold highlights, bullet points, and brief tables where appropriate. Keep answers readable on mobile screens.`;

export async function sendChatMessageToProxy(
  userPrompt: string,
  history: ChatMessage[] = [],
): Promise<{content: string; actionCard?: AIActionCardData}> {
  const apiKey = await getActiveAIApiKey();
  const primaryModel = await getActiveAIModel();

  // Convert history to OpenAI message format (last 10 messages)
  const messages: any[] = [
    {role: 'system', content: SYSTEM_PROMPT},
    ...history.slice(-10).map(m => ({
      role: m.role,
      content: m.content,
    })),
    {role: 'user', content: userPrompt},
  ];

  let collectedActionCard: AIActionCardData | undefined = undefined;
  const modelsToTry = [primaryModel, AI_MODELS.FAST_20B, AI_MODELS.QWEN_27B];

  for (const model of modelsToTry) {
    try {
      let turnCount = 0;
      const currentMessages = [...messages];

      while (turnCount < 4) {
        turnCount++;
        const res = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: currentMessages,
            tools: AI_TOOL_DEFINITIONS,
            tool_choice: 'auto',
            temperature: 0.3,
            max_tokens: 800,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Groq HTTP ${res.status}: ${errText}`);
        }

        const data = await res.json();
        const choice = data.choices?.[0];
        if (!choice) {
          throw new Error('No choice returned from Groq');
        }

        const message = choice.message;

        if (message.tool_calls && message.tool_calls.length > 0) {
          currentMessages.push({
            role: 'assistant',
            content: message.content || null,
            tool_calls: message.tool_calls,
          });

          for (const tc of message.tool_calls) {
            const toolName = tc.function.name;
            let toolArgs = {};
            try {
              toolArgs = JSON.parse(tc.function.arguments || '{}');
            } catch (e) {
              toolArgs = {};
            }

            const {result, actionCard} = await executeAITool(toolName, toolArgs);
            if (actionCard) {
              collectedActionCard = actionCard;
            }

            currentMessages.push({
              role: 'tool',
              tool_call_id: tc.id,
              content: result,
            });
          }
          // Continue loop to get the final assistant speech with tool outputs
          continue;
        }

        // Final assistant response
        let finalContent = message.content || 'I processed that request for you!';
        // Clean any reasoning tags
        finalContent = finalContent.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

        return {
          content: finalContent,
          actionCard: collectedActionCard,
        };
      }

      return {
        content: 'I reached the planning limit, but your attendance data is up to date.',
        actionCard: collectedActionCard,
      };
    } catch (err: any) {
      console.warn(`Model ${model} failed:`, err?.message || err);
      // Try next fallback model
    }
  }

  // Graceful fallback response if all Groq attempts fail
  return {
    content:
      "⚠️ Proxy couldn't reach the server right now (check internet or API quota in Settings). Your attendance records and timetable remain safe and stored locally on your device.",
  };
}
