// Raw wrapper around the YouTube Data API v3 search endpoint. This is the
// ONLY place that calls YouTube — every field on a YoutubeVideoResult comes
// straight from the API response; nothing here is invented or filled in by
// an LLM. The API key never reaches the client (Supabase secret, read only
// here in Deno), same rule as ANTHROPIC_API_KEY.

const YOUTUBE_SEARCH_ENDPOINT = 'https://www.googleapis.com/youtube/v3/search';
const MAX_RESULTS = 5;

export interface YoutubeVideoResult {
  video_id: string;
  title: string;
  channel_title: string;
  video_url: string;
  thumbnail_url: string;
  published_at: string;
}

/** Deno-side mirror of types/recipe.ts's RecipeYoutubeMetadata — kept in
 * sync manually, same reasoning as recipeMatching.ts's client/server split
 * (no cross-runtime import from types/ into Deno code). */
export interface RecipeYoutubeMetadata {
  technique: string;
  search_query: string;
  retrieved_at: string;
  results: YoutubeVideoResult[];
}

export function getYoutubeApiKey(): string {
  const apiKey = Deno.env.get('YOUTUBE_API_KEY');
  if (!apiKey) {
    throw new Error(
      'YOUTUBE_API_KEY is not set. Run `supabase secrets set YOUTUBE_API_KEY=...` (never as a client-side env var).'
    );
  }
  return apiKey;
}

/**
 * A genuinely empty `results` array is a valid, honest response — "the
 * search ran and found nothing." A thrown error means the search itself
 * couldn't run (bad key, quota exceeded, network failure) — callers should
 * treat those differently (the client shows a "couldn't load" state that
 * invites a retry, not a confident "no videos exist").
 */
export async function searchYoutube(query: string, apiKey: string): Promise<YoutubeVideoResult[]> {
  const url = new URL(YOUTUBE_SEARCH_ENDPOINT);
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('maxResults', String(MAX_RESULTS));
  url.searchParams.set('q', query);
  url.searchParams.set('key', apiKey);

  const response = await fetch(url.toString());
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`YouTube search failed (${response.status}): ${body.slice(0, 300)}`);
  }

  const data = await response.json();
  const items = Array.isArray(data?.items) ? data.items : [];

  const results: YoutubeVideoResult[] = [];
  for (const item of items) {
    const videoId = item?.id?.videoId;
    const snippet = item?.snippet;
    if (typeof videoId !== 'string' || !snippet || typeof snippet !== 'object') continue;

    const title = typeof snippet.title === 'string' ? snippet.title : null;
    const channelTitle = typeof snippet.channelTitle === 'string' ? snippet.channelTitle : null;
    const publishedAt = typeof snippet.publishedAt === 'string' ? snippet.publishedAt : null;
    const thumbnailUrl: string | null =
      snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url ?? null;

    // Skip any entry missing a field we'd need to render it — better to
    // return fewer real results than a result with a blank title/thumbnail.
    if (!title || !channelTitle || !publishedAt || !thumbnailUrl) continue;

    results.push({
      video_id: videoId,
      title,
      channel_title: channelTitle,
      video_url: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnail_url: thumbnailUrl,
      published_at: publishedAt,
    });
  }

  return results;
}
