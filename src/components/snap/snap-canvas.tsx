'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  ReactFlow,
  Controls,
  MiniMap,
  type Node,
  type Edge,
} from '@xyflow/react'
import dagre from 'dagre'
import '@xyflow/react/dist/style.css'
import { experimental_useObject as useObject } from 'ai/react'
import { z } from 'zod'
import { SnapNode, type SnapNodeData } from './snap-node'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

// All fields are optional: `useObject` delivers a DeepPartial as the stream arrives,
// so intermediate values are incomplete. The server-side schema (route.ts) uses
// required fields for full validation. The `as NonNullable<...>` casts below are
// safe because of the `rawNodes.length > 0` guard.
const SnapGraphSchema = z.object({
  type: z.enum(['brainstorm', 'summary', 'technical']).optional(),
  title: z.string().optional(),
  nodes: z.array(z.object({
    id: z.string(),
    label: z.string(),
    category: z.enum(['root', 'agreed', 'open', 'next', 'topic', 'point']),
  })).optional(),
  edges: z.array(z.object({
    source: z.string(),
    target: z.string(),
  })).optional(),
})

type SnapGraph = z.infer<typeof SnapGraphSchema>

const NODE_WIDTH = 160
const NODE_HEIGHT = 50

function applyDagreLayout(
  nodes: NonNullable<SnapGraph['nodes']>,
  edges: NonNullable<SnapGraph['edges']>,
): Node[] {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'TB', ranksep: 60, nodesep: 40 })
  g.setDefaultEdgeLabel(() => ({}))

  nodes.forEach(n => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }))
  edges.forEach(e => g.setEdge(e.source, e.target))
  dagre.layout(g)

  return nodes.map(n => ({
    id: n.id,
    type: 'snapNode',
    position: {
      x: g.node(n.id).x - NODE_WIDTH / 2,
      y: g.node(n.id).y - NODE_HEIGHT / 2,
    },
    data: { label: n.label, category: n.category } satisfies SnapNodeData,
  }))
}

const nodeTypes = { snapNode: SnapNode }

interface SnapCanvasProps {
  messages: { role: string; content: string }[]
  chatId: string
}

export function SnapCanvas({ messages, chatId }: SnapCanvasProps) {
  const [key, setKey] = useState(0)

  const { object, submit, isLoading, error, stop } = useObject({
    api: '/api/snap',
    schema: SnapGraphSchema,
  })

  const generate = useCallback(() => {
    submit({ messages, chatId })
  }, [messages, chatId, submit])

  useEffect(() => {
    generate()
    return () => { stop() }
    // Intentionally omit `generate` from deps: this effect should only
    // re-run when `key` changes (mount + Regenerate click), not whenever
    // `messages` or `chatId` change. `generate` is stable (useCallback)
    // but including it would re-trigger on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const handleRegenerate = () => {
    stop()
    setKey(k => k + 1)
  }

  const rawNodes = object?.nodes ?? []
  const rawEdges = object?.edges ?? []

  const flowNodes: Node[] = rawNodes.length > 0
    ? applyDagreLayout(rawNodes as NonNullable<SnapGraph['nodes']>, rawEdges as NonNullable<SnapGraph['edges']>)
    : []

  const flowEdges: Edge[] = rawEdges
    .filter(e => e?.source && e?.target)
    .map((e, i) => ({
      id: `e${i}`,
      source: e.source!,
      target: e.target!,
      style: { stroke: '#cbd5e1', strokeWidth: 1.5 },
    }))

  if (error) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-4">
        <p className="text-sm text-destructive">Failed to generate diagram.</p>
        <Button variant="outline" size="sm" onClick={handleRegenerate}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="h-full w-full relative">
      {isLoading && flowNodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="text-sm text-muted-foreground animate-pulse">Generating diagram…</div>
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        className="absolute top-4 right-4 z-10"
        onClick={handleRegenerate}
        disabled={isLoading}
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
        Regenerate
      </Button>

      {object?.title && (
        <div className="absolute top-4 left-4 z-10 text-sm font-semibold text-foreground">
          {object.title}
        </div>
      )}

      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Controls />
        <MiniMap nodeStrokeWidth={2} />
      </ReactFlow>
    </div>
  )
}
