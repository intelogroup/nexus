import { encode } from 'gpt-tokenizer'

// A simple utility to estimate tokens across different models
export function estimateTokens(text: string): number {
  try {
    // We use the gpt-tokenizer as a fast baseline standard. 
    // It encodes locally in the browser/Node without API calls.
    const tokens = encode(text)
    return tokens.length
  } catch (e) {
    // Fallback if tokenizer fails: ~4 characters per token
    return Math.ceil(text.length / 4)
  }
}

export const MODEL_LIMITS: Record<string, number> = {
  'gpt-4o': 128000,
  'claude-3-5-sonnet-20240620': 200000,
  'models/gemini-1.5-pro': 2000000,
  'grok-2': 128000,
}