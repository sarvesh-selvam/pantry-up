// Sous Chef — Phase 3's tool-oriented conversational recipe assistant.
// The LLM orchestrates tools; it never fabricates inventory, rescue items,
// or preferences — every fact it uses comes back from a real tool call
// against this user's actual data. generate_recipe's dietary-restriction
// enforcement (see _shared/recipeGeneration.ts) is structural, not just a
// system-prompt request.
//
// Stateless per request: the client resends the full text-only message
// history each turn (no tool_use/tool_result blocks replayed across turns —
// each turn re-fetches fresh tool data instead, so a later turn never acts
// on stale inventory/rescue data from earlier in the conversation).

import Anthropic from 'npm:@anthropic-ai/sdk';
import { corsHeaders } from '../_shared/cors.ts';
import { getUserSupabaseClient } from '../_shared/supabaseClient.ts';
import { CLAUDE_MODEL, getAnthropicClient } from '../_shared/anthropic.ts';
import { loadPantryContext, type PantryContext } from '../_shared/pantryContext.ts';
import { generateRecipes, type GeneratedRecipe } from '../_shared/recipeGeneration.ts';
import { matchRecipeToInventory, type MatchInventoryItem } from '../_shared/recipeMatching.ts';
import { buildRecipeSuggestionPayload, type RecipeSuggestionPayload } from '../_shared/recipePayload.ts';

const MAX_LOOP_ITERATIONS = 8;

const SYSTEM_PROMPT = `You are Sous Chef, PantryUp's cooking assistant chat. You help the user decide what to cook, grounded in their REAL pantry inventory — you never invent what they have.

Priority order when things conflict (highest first): food safety, dietary restrictions/allergies, the user's explicit request, using rescue ingredients (soon-to-expire, low quantity, or aging leftovers), using ingredients already in the pantry, staying within any stated time limit, cuisine preference, nutrition preference, available equipment, recipe variety. Dietary restrictions and allergies are hard constraints — generate_recipe enforces them automatically by rejecting and regenerating non-compliant recipes, but you must never suggest working around them.

Workflow for a cooking request:
1. Call get_inventory, get_rescue_items, and get_user_preferences (you may call these together) to ground yourself in real data before proposing anything.
2. Call generate_recipe with the user's own request as "constraints" (plus max_time_minutes / excluded_ingredients if they mentioned them).
3. Call match_recipe_to_inventory with the ingredients generate_recipe returned.
4. In your final reply: name the recipe, state pantry coverage ("X of Y ingredients you already have"), call out any rescue ingredients it uses, and give a short, specific "why this works" grounded in what the tools actually returned. Never just say "I recommend this" — always say why.

If generate_recipe reports it couldn't produce a dietary-compliant recipe, tell the user honestly rather than presenting something anyway.

If the user is just chatting and hasn't asked for a recipe, respond conversationally without calling tools.

create_shopping_items is not a real feature yet — if the user asks to add missing ingredients to a shopping list, call it anyway (it explains that's coming in a later phase) rather than claiming you did something you didn't.`;

interface RecipeContext {
  title: string;
  ingredients: string[];
  instructions: string[];
}

function buildSystemPrompt(recipeContext: RecipeContext | null): string {
  if (!recipeContext) return SYSTEM_PROMPT;

  return `${SYSTEM_PROMPT}

The user is currently cooking this recipe in Cooking Mode — ground your answers in it (ingredient substitutions, technique explanations, timing questions, etc.) without needing to call generate_recipe again unless they explicitly ask for a different recipe:

Title: ${recipeContext.title}
Ingredients:
${recipeContext.ingredients.map((ing) => `- ${ing}`).join('\n')}
Instructions:
${recipeContext.instructions.map((step, i) => `${i + 1}. ${step}`).join('\n')}`;
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_inventory',
    description:
      "Returns the user's current pantry inventory items: name, quantity, storage location, preparation state, and verification status.",
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_rescue_items',
    description:
      'Returns inventory items that need attention soon: expiring within 3 days, low/almost-empty quantity, or leftovers older than 2 days.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_user_preferences',
    description:
      "Returns the user's cuisine weights (soft signal), dietary restrictions (hard constraints), skill level, and equipment.",
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'generate_recipe',
    description:
      'Generates one recipe given constraints and the gathered pantry/rescue/preference context. Dietary restrictions are enforced automatically — non-compliant recipes are rejected and regenerated internally before this returns.',
    input_schema: {
      type: 'object',
      properties: {
        constraints: {
          type: 'string',
          description: 'The user\'s request in their own words, e.g. "something spicy, 30 minutes, no chicken".',
        },
        max_time_minutes: { type: 'number' },
        excluded_ingredients: { type: 'array', items: { type: 'string' } },
      },
      required: ['constraints'],
      additionalProperties: false,
    },
  },
  {
    name: 'match_recipe_to_inventory',
    description:
      "Classifies a recipe's ingredients against the user's real inventory as Already Have / Verify / Missing, and computes pantry coverage.",
    input_schema: {
      type: 'object',
      properties: {
        ingredients: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              canonical_food_id: { type: ['string', 'null'] },
              display_name: { type: 'string' },
              quantity_value: { type: ['number', 'null'] },
              quantity_unit: { type: ['string', 'null'] },
            },
            required: ['display_name'],
          },
        },
      },
      required: ['ingredients'],
      additionalProperties: false,
    },
  },
  {
    name: 'create_shopping_items',
    description:
      'STUB — the Need to Buy / shopping list feature is not built yet. Call this if the user asks to add missing ingredients to a shopping list; it explains that this is coming in a later phase and adds nothing.',
    input_schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: { display_name: { type: 'string' } },
            required: ['display_name'],
          },
        },
      },
      required: ['items'],
      additionalProperties: false,
    },
  },
];

interface ToolExecutionResult {
  result: unknown;
  generatedRecipe?: GeneratedRecipe;
}

async function executeTool(name: string, input: Record<string, unknown>, ctx: PantryContext): Promise<ToolExecutionResult> {
  switch (name) {
    case 'get_inventory':
      return { result: ctx.inventoryItems };

    case 'get_rescue_items':
      return { result: { rescue_item_names: ctx.rescueItemNames } };

    case 'get_user_preferences':
      return {
        result: {
          dietary_restrictions: ctx.dietaryRestrictions,
          cuisine_weights: ctx.cuisineWeights,
          skill_level: ctx.skillLevel,
        },
      };

    case 'generate_recipe': {
      const recipes = await generateRecipes(
        {
          constraints: typeof input.constraints === 'string' ? input.constraints : '',
          maxTimeMinutes: typeof input.max_time_minutes === 'number' ? input.max_time_minutes : null,
          excludedIngredients: Array.isArray(input.excluded_ingredients)
            ? (input.excluded_ingredients as string[])
            : [],
          inventorySummaryLines: ctx.inventorySummaryLines,
          rescueItemNames: ctx.rescueItemNames,
          dietaryRestrictions: ctx.dietaryRestrictions,
          cuisineWeights: ctx.cuisineWeights,
          skillLevel: ctx.skillLevel,
          canonicalFoods: ctx.canonicalFoods,
          nutritionData: ctx.nutritionData,
        },
        1
      );
      const recipe = recipes[0];
      return { result: recipe, generatedRecipe: recipe };
    }

    case 'match_recipe_to_inventory': {
      const ingredients = Array.isArray(input.ingredients) ? input.ingredients : [];
      const match = matchRecipeToInventory(
        ingredients as { canonical_food_id: string | null; quantity_value: number | null; quantity_unit: string | null }[],
        ctx.inventoryItems as unknown as MatchInventoryItem[]
      );
      return { result: match };
    }

    case 'create_shopping_items':
      console.log('create_shopping_items stub called with', input);
      return {
        result: {
          status: 'not_implemented',
          note: 'The Need to Buy / shopping list feature is coming in a later phase. Nothing was added.',
        },
      };

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function runOrchestration(
  anthropic: Anthropic,
  history: Anthropic.MessageParam[],
  ctx: PantryContext,
  recipeContext: RecipeContext | null
): Promise<{ reply: string; recipe: RecipeSuggestionPayload | null }> {
  const messages: Anthropic.MessageParam[] = [...history];
  let lastGeneratedRecipe: GeneratedRecipe | null = null;
  const systemPrompt = buildSystemPrompt(recipeContext);

  for (let iteration = 0; iteration < MAX_LOOP_ITERATIONS; iteration++) {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      output_config: { effort: 'medium' },
      system: systemPrompt,
      tools: TOOLS,
      messages,
    });

    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    if (response.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) {
      const textBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === 'text');
      const reply = textBlock?.text ?? "I'm not sure how to respond to that — could you rephrase?";
      const recipe = lastGeneratedRecipe
        ? buildRecipeSuggestionPayload(lastGeneratedRecipe, ctx.inventoryItems as unknown as MatchInventoryItem[])
        : null;
      return { reply, recipe };
    }

    messages.push({ role: 'assistant', content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUseBlocks) {
      try {
        const { result, generatedRecipe } = await executeTool(
          toolUse.name,
          (toolUse.input as Record<string, unknown>) ?? {},
          ctx
        );
        if (generatedRecipe) lastGeneratedRecipe = generatedRecipe;
        toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(result) });
      } catch (err) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          is_error: true,
          content: err instanceof Error ? err.message : 'Tool execution failed',
        });
      }
    }

    messages.push({ role: 'user', content: toolResults });
  }

  // Hit the iteration cap — still return whatever recipe was generated
  // rather than nothing, but be honest that the conversation was cut short.
  const recipe = lastGeneratedRecipe
    ? buildRecipeSuggestionPayload(lastGeneratedRecipe, ctx.inventoryItems as unknown as MatchInventoryItem[])
    : null;
  return {
    reply: "That took a bit longer than expected — here's what I've got so far.",
    recipe,
  };
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

    const { messages, recipeContext: rawRecipeContext } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return jsonResponse({ error: '"messages" must be a non-empty array' }, 400);
    }

    const recipeContext: RecipeContext | null =
      typeof rawRecipeContext === 'object' &&
      rawRecipeContext !== null &&
      typeof rawRecipeContext.title === 'string' &&
      Array.isArray(rawRecipeContext.ingredients) &&
      Array.isArray(rawRecipeContext.instructions)
        ? {
            title: rawRecipeContext.title,
            ingredients: rawRecipeContext.ingredients.filter((v: unknown): v is string => typeof v === 'string'),
            instructions: rawRecipeContext.instructions.filter((v: unknown): v is string => typeof v === 'string'),
          }
        : null;

    const history: Anthropic.MessageParam[] = messages
      .filter(
        (m: unknown): m is { role: string; content: string } =>
          typeof m === 'object' &&
          m !== null &&
          ((m as { role: unknown }).role === 'user' || (m as { role: unknown }).role === 'assistant') &&
          typeof (m as { content: unknown }).content === 'string'
      )
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    if (history.length === 0 || history[history.length - 1].role !== 'user') {
      return jsonResponse({ error: 'The last message must be from the user' }, 400);
    }

    const supabase = getUserSupabaseClient(authHeader);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return jsonResponse({ error: 'Not authenticated' }, 401);
    }

    const ctx = await loadPantryContext(supabase, user.id);
    const anthropic = getAnthropicClient();
    const { reply, recipe } = await runOrchestration(anthropic, history, ctx, recipeContext);

    return jsonResponse({ reply, recipe });
  } catch (err) {
    console.error('sous-chef-chat error', err);
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
