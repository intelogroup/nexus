export type RawNode = {
  id: string
  label: string
  category: 'root' | 'agreed' | 'open' | 'next' | 'topic' | 'point'
}

export type RawEdge = {
  source: string
  target: string
}

export type TreeNode = RawNode & {
  children: TreeNode[]
}

export type TreeResult = {
  root: TreeNode | null
  orphans: TreeNode[]
}

export function buildTree(nodes: RawNode[], edges: RawEdge[]): TreeResult {
  if (nodes.length === 0) return { root: null, orphans: [] }

  // Build adjacency map: source → target[]
  const childMap = new Map<string, string[]>()
  for (const edge of edges) {
    const existing = childMap.get(edge.source) ?? []
    existing.push(edge.target)
    childMap.set(edge.source, existing)
  }

  // Index nodes by id
  const nodeMap = new Map<string, RawNode>(nodes.map(n => [n.id, n]))

  // Track visited nodes to detect orphans
  const visited = new Set<string>()

  function buildNode(id: string): TreeNode {
    visited.add(id)
    const node = nodeMap.get(id)!
    const childIds = childMap.get(id) ?? []
    return {
      ...node,
      children: childIds
        .filter(cid => nodeMap.has(cid))
        .map(cid => buildNode(cid)),
    }
  }

  const rootNode = nodes.find(n => n.category === 'root')
  if (!rootNode) {
    // No root: return all nodes as orphans
    return { root: null, orphans: nodes.map(n => ({ ...n, children: [] })) }
  }

  const root = buildNode(rootNode.id)

  const orphans = nodes
    .filter(n => !visited.has(n.id))
    .map(n => ({ ...n, children: [] }))

  return { root, orphans }
}
