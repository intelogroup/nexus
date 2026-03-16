export type Provider = 'openai' | 'anthropic' | 'google' | 'xai'

export interface ModelDefinition {
  readonly id: string
  readonly label: string
  readonly provider: Provider
  readonly supportsTemperature: boolean
}

export const MODELS: readonly ModelDefinition[] = [
  // Claude 4 family
  { id: 'claude-opus-4-6',            label: 'Claude Opus 4.6',       provider: 'anthropic', supportsTemperature: true },
  { id: 'claude-sonnet-4-6',          label: 'Claude Sonnet 4.6 🔥',  provider: 'anthropic', supportsTemperature: true },
  { id: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku 4.5',      provider: 'anthropic', supportsTemperature: true },
  // Claude 3.7
  { id: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet',     provider: 'anthropic', supportsTemperature: true },
  // OpenAI GPT-4.1
  { id: 'gpt-4.1',                    label: 'GPT-4.1',                provider: 'openai',    supportsTemperature: true },
  { id: 'gpt-4.1-mini',               label: 'GPT-4.1 mini',          provider: 'openai',    supportsTemperature: true },
  // OpenAI reasoning — these do NOT accept a temperature parameter
  { id: 'o3',                         label: 'o3 (Reasoning)',         provider: 'openai',    supportsTemperature: false },
  { id: 'o4-mini',                    label: 'o4-mini (Reasoning)',    provider: 'openai',    supportsTemperature: false },
  // Google — verified via ai.google.dev/gemini-api/docs/models/gemini-3.1-pro-preview
  { id: 'gemini-3.1-pro-preview',     label: 'Gemini 3.1 Pro',        provider: 'google',    supportsTemperature: true },
  // xAI — verified via docs.x.ai/developers/models/grok-4
  { id: 'grok-4',                     label: 'Grok 4',                 provider: 'xai',       supportsTemperature: true },
]

export const DEFAULT_MODEL_ID = 'claude-sonnet-4-6'

// Startup assertion: fail fast if DEFAULT_MODEL_ID is not in MODELS
if (!MODELS.find(m => m.id === DEFAULT_MODEL_ID)) {
  throw new Error(`DEFAULT_MODEL_ID "${DEFAULT_MODEL_ID}" is not present in MODELS`)
}

/**
 * Returns the ModelDefinition for the given ID, or null if not found.
 * Callers must handle null (e.g. return HTTP 400).
 */
export function getModel(id: string): ModelDefinition | null {
  return MODELS.find(m => m.id === id) ?? null
}
