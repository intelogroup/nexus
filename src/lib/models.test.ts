import { describe, it, expect } from 'vitest'
import { MODELS, DEFAULT_MODEL_ID, getModel } from './models'

describe('MODELS registry', () => {
  it('has no duplicate IDs', () => {
    const ids = MODELS.map(m => m.id)
    const unique = new Set(ids)
    expect(ids.length).toBe(unique.size)
  })

  it('every entry has non-empty id, label, valid provider, and boolean supportsTemperature', () => {
    const validProviders = ['openai', 'anthropic', 'google', 'xai']
    for (const m of MODELS) {
      expect(m.id.length).toBeGreaterThan(0)
      expect(m.label.length).toBeGreaterThan(0)
      expect(validProviders).toContain(m.provider)
      expect(typeof m.supportsTemperature).toBe('boolean')
    }
  })

  it('all reasoning models have supportsTemperature: false', () => {
    const reasoning = MODELS.filter(m => m.id === 'o3' || m.id === 'o4-mini')
    expect(reasoning.length).toBeGreaterThan(0)
    for (const m of reasoning) {
      expect(m.supportsTemperature).toBe(false)
    }
  })
})

describe('DEFAULT_MODEL_ID', () => {
  it('resolves to a valid entry without triggering fallback', () => {
    const def = getModel(DEFAULT_MODEL_ID)
    expect(def).not.toBeNull()
    expect(def!.id).toBe(DEFAULT_MODEL_ID)
  })
})

describe('getModel', () => {
  it('returns the correct definition for a known ID', () => {
    const def = getModel('claude-sonnet-4-6')
    expect(def).not.toBeNull()
    expect(def!.provider).toBe('anthropic')
    expect(def!.supportsTemperature).toBe(true)
  })

  it('returns null for an unknown ID', () => {
    expect(getModel('unknown-model-xyz')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(getModel('')).toBeNull()
  })
})
