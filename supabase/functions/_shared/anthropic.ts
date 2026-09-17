import Anthropic from 'npm:@anthropic-ai/sdk';

export const CLAUDE_MODEL = 'claude-sonnet-5';

/** First text block's content, or throws if the model didn't return one
 * (e.g. it only returned a refusal). */
export function extractResponseText(message: Anthropic.Message): string {
  const textBlock = message.content.find(
    (block): block is Anthropic.TextBlock => block.type === 'text'
  );
  if (!textBlock) {
    throw new Error(`Model returned no text content (stop_reason: ${message.stop_reason})`);
  }
  return textBlock.text;
}

export function getAnthropicClient(): Anthropic {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Run `supabase secrets set ANTHROPIC_API_KEY=...` (never as a client-side env var).'
    );
  }
  return new Anthropic({ apiKey });
}
