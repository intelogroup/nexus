import { describe, it, expect } from 'vitest'
import { formatConnectedLabels } from './flow-node'

describe('formatConnectedLabels', () => {
  it('returns null for empty array', () => {
    expect(formatConnectedLabels([])).toBeNull()
  })

  it('formats single label', () => {
    expect(formatConnectedLabels(['Topic A'])).toBe('Connects to: Topic A')
  })

  it('formats multiple labels', () => {
    expect(formatConnectedLabels(['Topic A', 'Topic B'])).toBe('Connects to: Topic A, Topic B')
  })
})
