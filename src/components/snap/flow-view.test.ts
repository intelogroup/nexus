import { describe, it, expect } from 'vitest'
import { buildConnectedLabels } from './flow-view'

const NODES = [
  { id: 'n1', label: 'Root', category: 'root' as const, description: 'The root node.' },
  { id: 'n2', label: 'Topic A', category: 'topic' as const },
  { id: 'n3', label: 'Point 1', category: 'point' as const },
]

const EDGES = [
  { source: 'n1', target: 'n2' },
  { source: 'n2', target: 'n3' },
]

describe('buildConnectedLabels', () => {
  it('maps source node to target label', () => {
    const map = buildConnectedLabels(NODES, EDGES)
    expect(map['n1']).toContain('Topic A')
  })

  it('maps target node to source label (bidirectional)', () => {
    const map = buildConnectedLabels(NODES, EDGES)
    expect(map['n2']).toContain('Root')
  })

  it('accumulates multiple connections', () => {
    const map = buildConnectedLabels(NODES, EDGES)
    expect(map['n2']).toContain('Root')
    expect(map['n2']).toContain('Point 1')
  })

  it('returns empty array for node with no connections', () => {
    const isolated = [{ id: 'x1', label: 'Alone', category: 'point' as const }]
    const map = buildConnectedLabels(isolated, [])
    expect(map['x1'] ?? []).toEqual([])
  })
})
