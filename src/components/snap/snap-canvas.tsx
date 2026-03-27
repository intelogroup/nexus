'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { experimental_useObject as useObject } from 'ai/react'
import { z } from 'zod'
import { RefreshCw, List, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildTree } from './snap-tree'
import type { SnapGraph } from '@/app/api/snap/route'
import { OutlineView } from './outline-view'
import { FlowView } from './flow-view'

// Client-side schema: all fields optional (DeepPartial during streaming)
const SnapGraphSchema = z.object({
  type: z.enum(['brainstorm', 'summary', 'technical']).optional(),
  title: z.string().optional(),
  nodes: z.array(z.object({
    id: z.string(),
    label: z.string(),
    category: z.enum(['root', 'agreed', 'open', 'next', 'topic', 'point']),
    description: z.string().optional(), // NEW
  })).optional(),
  edges: z.array(z.object({
    source: z.string(),
    target: z.string(),
  })).optional(),
})

// ─── Cache helpers ───────────────────────────────────────────────────
type SnapCache = {
  graph: SnapGraph
  messageCount: number
  contentHash: number
}

function hashMessages(messages: { role: string; content: string }[]): number {
  const str = messages.map(m => m.role + ':' + m.content).join('|')
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return hash
}

function readCache(chatId: string): SnapCache | null {
  try {
    const raw = localStorage.getItem(`snap_cache_${chatId}`)
    return raw ? (JSON.parse(raw) as SnapCache) : null
  } catch {
    return null
  }
}

function writeCache(chatId: string, graph: SnapGraph, messageCount: number, contentHash: number) {
  try {
    localStorage.setItem(
      `snap_cache_${chatId}`,
      JSON.stringify({ graph, messageCount, contentHash } satisfies SnapCache),
    )
  } catch {
    // localStorage unavailable (private mode, etc.) — silently skip
  }
}

// ─── Main component ──────────────────────────────────────────────────
interface SnapCanvasProps {
  messages: { role: string; content: string }[]
  chatId: string
}

export function SnapCanvas({ messages, chatId }: SnapCanvasProps) {
  const [key, setKey] = useState(0)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'outline' | 'flow'>('outline')
  const [cachedGraph, setCachedGraph] = useState<SnapGraph | null>(null)
  const wasLoadingRef = useRef(false)

  const { object, submit, isLoading, error, stop } = useObject({
    api: '/api/snap',
    schema: SnapGraphSchema,
  })

  const generate = useCallback(() => {
    submit({ messages, chatId })
  }, [messages, chatId, submit])

  // On mount (or after Regenerate): check cache before calling API
  useEffect(() => {
    const cache = readCache(chatId)
    if (cache && cache.messageCount === messages.length && cache.contentHash === hashMessages(messages)) {
      setCachedGraph(cache.graph)
      return // skip API call
    }
    setCachedGraph(null)
    generate()
    return () => { stop() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Write cache when stream completes — only if all required SnapGraph fields are present
  useEffect(() => {
    if (
      wasLoadingRef.current &&
      !isLoading &&
      object?.type &&
      object?.title &&
      object?.nodes?.length
    ) {
      writeCache(chatId, object as SnapGraph, messages.length, hashMessages(messages))
    }
    wasLoadingRef.current = isLoading
  }, [isLoading, object, chatId, messages])

  const handleRegenerate = () => {
    setCachedGraph(null)
    setCollapsed(new Set())
    wasLoadingRef.current = false
    try { stop() } catch { /* AbortError expected */ }
    setKey(k => k + 1)
  }

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  // Use cachedGraph if available, otherwise use streaming object
  const activeGraph = cachedGraph ?? object

  // Filter streaming nodes to fully-present only
  const rawNodes = (activeGraph?.nodes ?? []).filter(
    n => n?.id && n?.label && n?.category,
  ) as { id: string; label: string; category: 'root' | 'agreed' | 'open' | 'next' | 'topic' | 'point'; description?: string }[]

  const nodeIds = new Set(rawNodes.map(n => n.id))
  const rawEdges = (activeGraph?.edges ?? []).filter(
    e => e?.source && e?.target && nodeIds.has(e.source) && nodeIds.has(e.target),
  ) as { source: string; target: string }[]

  const { root, orphans } = buildTree(rawNodes, rawEdges)

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
    <div className={`h-full w-full relative ${viewMode === 'outline' ? 'overflow-y-auto' : 'overflow-hidden'}`}>
      {/* Header row */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-background border-b">
        <span className="text-sm font-semibold text-foreground truncate">
          {activeGraph?.title ?? ''}
        </span>
        {/* View mode toggle */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('outline')}
            className={`p-1.5 rounded ${viewMode === 'outline' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            aria-label="Outline view"
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setViewMode('flow')}
            className={`p-1.5 rounded ${viewMode === 'flow' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            aria-label="Flow view"
          >
            <Share2 size={16} />
          </button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRegenerate}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Regenerate
        </Button>
      </div>

      {viewMode === 'outline' && (
        <OutlineView
          root={root}
          orphans={orphans}
          isLoading={isLoading}
          collapsed={collapsed}
          onToggle={toggleCollapse}
        />
      )}
      {viewMode === 'flow' && (
        <FlowView
          initialNodes={rawNodes}
          initialEdges={rawEdges}
          isLoading={isLoading}
        />
      )}
    </div>
  )
}
