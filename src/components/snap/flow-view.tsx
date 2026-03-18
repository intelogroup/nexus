'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  useReactFlow,
  type Node,
  type Edge,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from '@dagrejs/dagre'
import { FlowNode, type FlowNodeData } from './flow-node'

// ─── Pure helper (exported for testing) ────────────────────────────
type RawNode = { id: string; label: string; category: string; description?: string }
type RawEdge = { source: string; target: string }

export function buildConnectedLabels(
  nodes: RawNode[],
  edges: RawEdge[],
): Record<string, string[]> {
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]))
  const result: Record<string, string[]> = {}

  edges.forEach(e => {
    const targetLabel = nodeMap[e.target]?.label
    const sourceLabel = nodeMap[e.source]?.label
    if (targetLabel) {
      result[e.source] = [...(result[e.source] ?? []), targetLabel]
    }
    if (sourceLabel) {
      result[e.target] = [...(result[e.target] ?? []), sourceLabel]
    }
  })

  return result
}

// ─── Dagre layout ───────────────────────────────────────────────────
const NODE_WIDTH = 220
const NODE_HEIGHT = 60

function applyDagreLayout(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', ranksep: 80, nodesep: 24 })

  nodes.forEach(n => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }))
  edges.forEach(e => g.setEdge(e.source, e.target))

  dagre.layout(g)

  const positioned = nodes.map(n => {
    const { x, y } = g.node(n.id)
    return { ...n, position: { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 } }
  })

  return { nodes: positioned, edges }
}

// ─── Node types ─────────────────────────────────────────────────────
const nodeTypes = { snapNode: FlowNode }

// ─── Inner canvas (must be inside ReactFlowProvider to call useReactFlow) ──
interface FlowCanvasProps {
  initialNodes: RawNode[]
  initialEdges: RawEdge[]
}

function FlowCanvas({ initialNodes, initialEdges }: FlowCanvasProps) {
  const { fitView, getNodes, getEdges } = useReactFlow()
  const connectedLabels = buildConnectedLabels(initialNodes, initialEdges)

  // 1. State FIRST so runLayout can close over setNodes/setEdges
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])

  // 2. runLayout references setNodes/setEdges
  const runLayout = useCallback(
    (rawNodes: Node[], rawEdges: Edge[], opts: { fitView: boolean }) => {
      const { nodes: positioned, edges: laid } = applyDagreLayout(rawNodes, rawEdges)
      setNodes(positioned)
      setEdges(laid)
      if (opts.fitView) {
        setTimeout(() => fitView({ padding: 0.2 }), 0)
      }
    },
    [fitView],
  )

  // 3. handleDelete reads live state via getNodes/getEdges — no state in deps
  const handleDelete = useCallback(
    (id: string) => {
      const currentNodes = getNodes()
      const currentEdges = getEdges()
      const updatedNodes = currentNodes.filter(n => n.id !== id)
      const updatedEdges = currentEdges.filter(e => e.source !== id && e.target !== id)
      runLayout(updatedNodes, updatedEdges, { fitView: false })
    },
    [getNodes, getEdges, runLayout],
  )

  // 4. Build RF nodes helper
  const buildRFEdges = (rawEdges: RawEdge[]): Edge[] =>
    rawEdges.map((e, i) => ({
      id: `e-${i}`,
      source: e.source,
      target: e.target,
      type: 'smoothstep',
      style: { strokeDasharray: '5,5', stroke: '#cbd5e1' },
    }))

  const buildRFNodes = (rawNodes: RawNode[], onDelete: (id: string) => void): Node<FlowNodeData>[] =>
    rawNodes.map(n => ({
      id: n.id,
      type: 'snapNode',
      position: { x: 0, y: 0 }, // overwritten by dagre
      data: {
        label: n.label,
        category: n.category as FlowNodeData['category'],
        description: n.description,
        connectedLabels: connectedLabels[n.id] ?? [],
        onDelete,
      },
    }))

  // 5. Initial layout — runs once on mount only
  useEffect(() => {
    const initialRFNodes = buildRFNodes(initialNodes, handleDelete)
    const initialRFEdges = buildRFEdges(initialEdges)
    runLayout(initialRFNodes, initialRFEdges, { fitView: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally empty — runs once on mount only

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnDrag
      zoomOnScroll
      fitView={false}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cbd5e1" />
    </ReactFlow>
  )
}

// ─── Public component ────────────────────────────────────────────────
export interface FlowViewProps {
  initialNodes: RawNode[]
  initialEdges: RawEdge[]
  isLoading: boolean
}

export function FlowView({ initialNodes, initialEdges, isLoading }: FlowViewProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground animate-pulse">Generating diagram…</p>
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      <ReactFlowProvider>
        <FlowCanvas initialNodes={initialNodes} initialEdges={initialEdges} />
      </ReactFlowProvider>
    </div>
  )
}
