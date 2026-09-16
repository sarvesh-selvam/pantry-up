// Identifies the single most important/non-obvious cooking technique in a
// recipe, to use as a YouTube search query. This is the model's ONLY job
// in the whole recipe-videos pipeline — it never sees or touches actual
// video results, which come strictly from a real YouTube Data API call
// (see youtubeSearch.ts). One small, fast, text-only Claude call.

import { CLAUDE_MODEL, extractResponseText, getAnthropicClient } from './anthropic.ts';

export interface TechniqueRecipeInput {
  title: string;
  ingredients: string[];
  instructions: string[];
}

export async function identifyKeyTechnique(recipe: TechniqueRecipeInput): Promise<string> {
  const system = `You identify the single most important or non-obvious cooking technique in a recipe, to use as a YouTube search query for a demonstration video.

Prefer a specific, non-trivial technique over something generic — e.g. "how to temper eggs for custard" or "Japanese chicken karaage double frying technique," not something trivial like "boil water" or "chop an onion." If the recipe genuinely has no non-obvious technique, name its most complex single step instead.

Respond with ONLY a JSON object of the exact shape {"technique": string}. No other text, no markdown code fences.`;

  const anthropic = getAnthropicClient();
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 200,
    output_config: { effort: 'low' },
    system,
    messages: [
      {
        role: 'user',
        content: `Title: ${recipe.title}

Ingredients:
${recipe.ingredients.join('\n')}

Instructions:
${recipe.instructions.map((step, i) => `${i + 1}. ${step}`).join('\n')}`,
      },
    ],
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractResponseText(response));
  } catch {
    throw new Error('Model did not return valid JSON identifying a technique');
  }

  const technique =
    typeof parsed === 'object' &&
    parsed !== null &&
    typeof (parsed as Record<string, unknown>).technique === 'string'
      ? ((parsed as Record<string, unknown>).technique as string).trim()
      : null;

  if (!technique) {
    throw new Error('Model response did not include a technique string');
  }
  return technique;
}
