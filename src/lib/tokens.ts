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
  // Claude 4 family — 200k context (docs.anthropic.com)
  'claude-opus-4-6':           200000,
  'claude-sonnet-4-6':         200000,
  'claude-haiku-4-5-20251001': 200000,
  // GPT-5 family — 1M context (platform.openai.com)
  'gpt-5.4':   1000000,
  'gpt-5.2':   1000000,
  'gpt-5-pro': 1000000,
  'gpt-5':     1000000,
  'gpt-5-mini': 128000,
  // GPT-4.1 family — 1,047,576 tokens (platform.openai.com)
  'gpt-4.1':      1047576,
  'gpt-4.1-mini': 1047576,
  'gpt-4.1-nano': 1047576,
  // OpenAI reasoning
  'o3':     200000,
  'o4-mini': 200000,
  'o1-pro':  200000,
  // Google Gemini 3.1 Pro — 1M context (ai.google.dev)
  'gemini-3.1-pro-preview': 1000000,
  // xAI Grok 4 — 256k context (docs.x.ai)
  'grok-4': 256000,
}
