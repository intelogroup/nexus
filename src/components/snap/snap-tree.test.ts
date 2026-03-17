import { describe, it, expect } from 'vitest'
import { buildTree, type TreeNode } from './snap-tree'

const NODES = [
  { id: 'n1', label: 'Root', category: 'root' as const },
  { id: 'n2', label: 'Topic A', category: 'topic' as const },
  { id: 'n3', label: 'Point 1', category: 'point' as const },
  { id: 'n4', label: 'Point 2', category: 'point' as const },
  { id: 'n5', label: 'Topic B', category: 'topic' as const },
]

const EDGES = [
  { source: 'n1', target: 'n2' },
  { source: 'n1', target: 'n5' },
  { source: 'n2', target: 'n3' },
  { source: 'n2', target: 'n4' },
]

describe('buildTree', () => {
  it('returns root as the first element', () => {
    const { root } = buildTree(NODES, EDGES)
    expect(root?.id).toBe('n1')
  })

  it('attaches direct children to root', () => {
    const { root } = buildTree(NODES, EDGES)
    expect(root?.children.map(c => c.id)).toEqual(['n2', 'n5'])
  })

  it('attaches grandchildren to their parent', () => {
    const { root } = buildTree(NODES, EDGES)
    const topicA = root?.children.find(c => c.id === 'n2')
    expect(topicA?.children.map(c => c.id)).toEqual(['n3', 'n4'])
  })

  it('leaf nodes have empty children array', () => {
    const { root } = buildTree(NODES, EDGES)
    const topicB = root?.children.find(c => c.id === 'n5')
    expect(topicB?.children).toEqual([])
  })

  it('collects orphan nodes not reachable from root', () => {
    const nodesWithOrphan = [
      ...NODES,
      { id: 'n9', label: 'Orphan', category: 'point' as const },
    ]
    const { orphans } = buildTree(nodesWithOrphan, EDGES)
    expect(orphans.map(o => o.id)).toContain('n9')
  })

  it('returns null root when no root node exists', () => {
    const { root } = buildTree([], [])
    expect(root).toBeNull()
  })

  it('handles missing edges gracefully (no edges at all)', () => {
    const { root } = buildTree(NODES, [])
    expect(root?.id).toBe('n1')
    expect(root?.children).toEqual([])
  })
})
