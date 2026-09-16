// Receipt scan — extracts grocery line items from a photo, then runs them
// through the SAME canonical-food matching pipeline as quick-add-parse.
// Input: { storagePath: string } — path of an already-uploaded image in the
// "receipts" Storage bucket, e.g. "<user_id>/1700000000000.jpg".
// Output: { items: NormalizedItem[] } — suggestions only, same contract as
// quick-add-parse. Never writes to inventory_items.

import { encodeBase64 } from 'jsr:@std/encoding/base64';
import { corsHeaders } from '../_shared/cors.ts';
import { getUserSupabaseClient } from '../_shared/supabaseClient.ts';
import { CLAUDE_MODEL, extractResponseText, getAnthropicClient } from '../_shared/anthropic.ts';
import {
  buildCanonicalFoodsReference,
  NORMALIZATION_OUTPUT_INSTRUCTIONS,
  parseNormalizedItems,
  type CanonicalFoodRef,
} from '../_shared/matching.ts';

// The client (lib/receiptScanner.ts) always normalizes the photo to JPEG
// before upload — via expo-image-manipulator — specifically because Claude's
// vision API doesn't accept HEIC, which is the iOS camera's default format.

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }

    const { storagePath } = await req.json();
    if (typeof storagePath !== 'string' || !storagePath.trim()) {
      return jsonResponse({ error: '"storagePath" is required' }, 400);
    }

    const supabase = getUserSupabaseClient(authHeader);

    const { data: imageBlob, error: downloadError } = await supabase.storage
      .from('receipts')
      .download(storagePath);
    if (downloadError || !imageBlob) {
      return jsonResponse(
        { error: `Failed to download receipt image: ${downloadError?.message ?? 'not found'}` },
        404
      );
    }

    const { data: canonicalFoods, error: foodsError } = await supabase
      .from('canonical_foods')
      .select('id, canonical_name, category, aliases');
    if (foodsError) {
      return jsonResponse({ error: `Failed to load canonical foods: ${foodsError.message}` }, 500);
    }

    const foodRefs = (canonicalFoods ?? []) as CanonicalFoodRef[];
    const validIds = new Set(foodRefs.map((food) => food.id));

    const imageBase64 = encodeBase64(await imageBlob.arrayBuffer());

    const system = `You extract grocery line items from a photo of a store receipt.

Only extract what is actually printed and legible on the receipt: item
names, quantities where legible, and a likely food category. Do NOT
extract, infer, or invent prices, totals, taxes, or store information. Do
NOT invent items that are not visible on the receipt. If a line item's
name is abbreviated or unclear, use your best plain-English guess for
display_name but keep the original printed text as raw_text.

Match each extracted item against the reference list of known foods below.

Reference foods:
${buildCanonicalFoodsReference(foodRefs)}

${NORMALIZATION_OUTPUT_INSTRUCTIONS}`;

    const anthropic = getAnthropicClient();
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      output_config: { effort: 'medium' },
      system,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
            },
            { type: 'text', text: 'Extract the grocery line items from this receipt.' },
          ],
        },
      ],
    });

    const items = parseNormalizedItems(extractResponseText(response), validIds);
    return jsonResponse({ items });
  } catch (err) {
    console.error('receipt-scan error', err);
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
