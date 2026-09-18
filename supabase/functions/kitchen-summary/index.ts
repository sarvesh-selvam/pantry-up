// Home's kitchen-summary card — a short, witty narration of what's
// actually in the Rescue Row and today's ranked suggestions. Input is
// exactly what Home already has on screen (client-computed rescue items,
// already-ranked suggestions from recipe-suggestions) — this function
// invents nothing new to fetch, it only narrates real data the client
// hands it. The model is instructed never to reference an item, quantity,
// or timeframe that isn't literally present in that input — same
// grounding discipline as why_bullets (recommendationScoring.ts) and
// every other narration in this app. Never writes anywhere; the client
// just renders the returned string.

import { corsHeaders } from '../_shared/cors.ts';
import { getUserSupabaseClient } from '../_shared/supabaseClient.ts';
import { CLAUDE_MODEL, extractResponseText, getAnthropicClient } from '../_shared/anthropic.ts';

interface RescueItemInput {
  name: string;
  status: string;
  detail: string;
}

interface SuggestionInput {
  title: string;
  coverage: string;
  missing: number;
}

function buildSystemPrompt(): string {
  return `You write a short, witty, one-breath summary of what's going on in the user's kitchen right now, for a card at the top of PantryUp's Home screen. Voice: confident, dry, a little playful — like a sharp cook texting a friend, not a corporate assistant. You are the app's "Sous Chef" persona.

STRICT RULES:
- Only reference ingredients, statuses, timeframes, and recipe titles that appear literally in the data below. Never invent an ingredient, a quantity, or a fact not given.
- 1-3 short sentences total. Plain text only — no markdown, no emoji, no bullet points, no quotation marks around the whole thing.
- If there are no rescue items, don't manufacture urgency. If there are no suggestions, don't claim anything is cookable.
- Only say something is "cookable" or "ready to go" if the suggestion data actually shows low or zero missing ingredients — never assume.

Respond with ONLY a JSON object of the exact shape: {"summary": string}. No other text, no markdown fences.`;
}

function buildUserPrompt(rescueItems: RescueItemInput[], suggestions: SuggestionInput[]): string {
  const rescueLines = rescueItems.length
    ? rescueItems.map((r) => `- ${r.name}: ${r.status} (${r.detail})`).join('\n')
    : '(nothing needs rescuing right now)';

  const suggestionLines = suggestions.length
    ? suggestions
        .map((s) => `- "${s.title}": ${s.coverage}, ${s.missing} ingredient${s.missing === 1 ? '' : 's'} missing`)
        .join('\n')
    : '(no recipe suggestions available right now)';

  return `Rescue items (need using soon), most urgent first:\n${rescueLines}\n\nToday's top recipe suggestions (already ranked, best first):\n${suggestionLines}`;
}

interface ParsedSummary {
  summary: string;
}

function parseSummary(rawResponseText: string): ParsedSummary {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawResponseText);
  } catch {
    throw new Error('Model did not return valid JSON');
  }
  const summary =
    typeof parsed === 'object' && parsed !== null && typeof (parsed as Record<string, unknown>).summary === 'string'
      ? ((parsed as Record<string, unknown>).summary as string).trim()
      : null;
  if (!summary) {
    throw new Error('Model response did not include a summary string');
  }
  return { summary };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }

    const supabase = getUserSupabaseClient(authHeader);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return jsonResponse({ error: 'Not authenticated' }, 401);
    }

    const { rescueItems, suggestions } = await req.json();
    if (!Array.isArray(rescueItems) || !Array.isArray(suggestions)) {
      return jsonResponse({ error: '"rescueItems" and "suggestions" arrays are required' }, 400);
    }

    const anthropic = getAnthropicClient();
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 300,
      output_config: { effort: 'low' },
      system: buildSystemPrompt(),
      messages: [{ role: 'user', content: buildUserPrompt(rescueItems, suggestions) }],
    });

    const { summary } = parseSummary(extractResponseText(response));
    return jsonResponse({ summary });
  } catch (err) {
    console.error('kitchen-summary error', err);
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
