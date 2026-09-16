// Quick Add normalization — replaces Phase 1's deterministic regex parser.
// Input: { text: string } — the raw Quick Add text the user typed.
// Output: { items: NormalizedItem[] } — suggestions only. This function
// never writes to inventory_items; the client always routes the result
// through the Quick Add review/confirm screen before saving anything.

import { corsHeaders } from '../_shared/cors.ts';
import { getUserSupabaseClient } from '../_shared/supabaseClient.ts';
import { CLAUDE_MODEL, extractResponseText, getAnthropicClient } from '../_shared/anthropic.ts';
import {
  buildCanonicalFoodsReference,
  NORMALIZATION_OUTPUT_INSTRUCTIONS,
  parseNormalizedItems,
  type CanonicalFoodRef,
} from '../_shared/matching.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }

    const { text } = await req.json();
    if (typeof text !== 'string' || !text.trim()) {
      return jsonResponse({ error: '"text" is required' }, 400);
    }

    const supabase = getUserSupabaseClient(authHeader);
    const { data: canonicalFoods, error: foodsError } = await supabase
      .from('canonical_foods')
      .select('id, canonical_name, category, aliases');
    if (foodsError) {
      return jsonResponse({ error: `Failed to load canonical foods: ${foodsError.message}` }, 500);
    }

    const foodRefs = (canonicalFoods ?? []) as CanonicalFoodRef[];
    const validIds = new Set(foodRefs.map((food) => food.id));

    const system = `You turn a shopper's freeform grocery list into structured inventory items.

Split the input into individual grocery items (it may be comma-separated,
use "and", or be on separate lines). For each item, extract any stated
quantity and unit, and match it against the reference list of known foods
below.

Reference foods:
${buildCanonicalFoodsReference(foodRefs)}

${NORMALIZATION_OUTPUT_INSTRUCTIONS}`;

    const anthropic = getAnthropicClient();
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      output_config: { effort: 'low' },
      system,
      messages: [{ role: 'user', content: text }],
    });

    const items = parseNormalizedItems(extractResponseText(response), validIds);
    return jsonResponse({ items });
  } catch (err) {
    console.error('quick-add-parse error', err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      500
    );
  }
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
