import Anthropic from '@anthropic-ai/sdk';

// Without a key, the shopping assistant is off and the store works as before. Tests point the client
// at a local stand-in with ANTHROPIC_BASE_URL, which the SDK reads itself
export const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

// A small, cheap model is enough for finding products and answering short questions
export const CHAT_MODEL = process.env.CHAT_MODEL || 'claude-haiku-5-5';
