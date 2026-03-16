import { describe, it, expect, vi } from 'vitest'
import { resolveProvider } from './route'

// Mock the AI SDKs
vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn((model) => ({ model, provider: 'openai' })),
  createOpenAI: vi.fn(() => (model: string) => ({ model, provider: 'xai' })),
}))
vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn((model) => ({ model, provider: 'anthropic' })),
}))
vi.mock('@ai-sdk/google', () => ({
  google: vi.fn((model) => ({ model, provider: 'google' })),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

describe('resolveProvider (backward compat wrapper)', () => {
  it('resolves claude-sonnet-4-6 to anthropic', () => {
    expect(resolveProvider('claude-sonnet-4-6').provider).toBe('anthropic')
  })

  it('resolves gpt-4.1 to openai', () => {
    expect(resolveProvider('gpt-4.1').provider).toBe('openai')
  })

  it('resolves gemini-3.1-pro-preview to google', () => {
    expect(resolveProvider('gemini-3.1-pro-preview').provider).toBe('google')
  })

  it('resolves grok-4 to xai', () => {
    expect(resolveProvider('grok-4').provider).toBe('xai')
  })

  it('falls back gracefully for unknown model (returns openai)', () => {
    // resolveProvider is a legacy wrapper — it keeps the old fallback behavior
    // so old callers don't break. The POST route itself returns 400 for unknowns.
    const result = resolveProvider('unknown-model')
    expect(result.provider).toBe('openai')
  })
})
