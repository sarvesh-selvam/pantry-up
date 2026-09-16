// Live YouTube technique video search — Phase 7. Input:
// { recipe: { title, ingredients: string[], instructions: string[] } } —
// the same {title, ingredients, instructions} shape sous-chef-chat's
// recipeContext already uses, so the client can reuse one mapper
// (lib/api/youtube.ts's toVideoLookupInput) for every call site.
//
// The LLM's ONLY job here is deciding what to search for
// (identifyKeyTechnique, one small text-only Claude call). The actual
// video metadata returned always comes straight from a real YouTube Data
// API response (searchYoutube) — never fabricated, never invented by the
// model. This function never writes to `recipes`; the client persists the
// result after getting it back, same "suggestions only" rule as every
// other function here.

import { corsHeaders } from '../_shared/cors.ts';
import { getUserSupabaseClient } from '../_shared/supabaseClient.ts';
import { identifyKeyTechnique } from '../_shared/techniqueIdentification.ts';
import { getYoutubeApiKey, searchYoutube } from '../_shared/youtubeSearch.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }

    // Auth-gated even though this function never touches the database —
    // it's the only thing standing between the shared YOUTUBE_API_KEY and
    // an unauthenticated caller burning its quota.
    const supabase = getUserSupabaseClient(authHeader);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return jsonResponse({ error: 'Not authenticated' }, 401);
    }

    const { recipe } = await req.json();
    if (
      !recipe ||
      typeof recipe.title !== 'string' ||
      !Array.isArray(recipe.ingredients) ||
      !Array.isArray(recipe.instructions)
    ) {
      return jsonResponse({ error: '"recipe" with title/ingredients/instructions is required' }, 400);
    }

    const technique = await identifyKeyTechnique({
      title: recipe.title,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
    });

    // Steering toward technique demonstrations over generic content via
    // query phrasing, per spec — not complex result filtering.
    const searchQuery = `${technique} technique`;
    const results = await searchYoutube(searchQuery, getYoutubeApiKey());

    return jsonResponse({
      technique,
      search_query: searchQuery,
      retrieved_at: new Date().toISOString(),
      results,
    });
  } catch (err) {
    console.error('recipe-videos error', err);
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
