'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { experimental_useObject as useObject } from 'ai/react'
import { z } from 'zod'
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { buildTree, type TreeNode } from './snap-tree'
import type { SnapGraph } from '@/app/api/snap/route'

// Client-side schema: all fields optional (DeepPartial during streaming)
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

// ─── Category styles ────────────────────────────────────────────────
type CategoryStyle = { bg: string; border?: string; icon: string }

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  root:   { bg: '#1a1a2e',                    icon: '🗨' },
  agreed: { bg: '#dcfce7', border: '#22c55e', icon: '✅' },
  open:   { bg: '#fef9c3', border: '#eab308', icon: '⚠️' },
  next:   { bg: '#dbeafe', border: '#3b82f6', icon: '➡' },
  topic:  { bg: '#f3e8ff', border: '#a855f7', icon: '' },
  point:  { bg: '#f8fafc', border: '#e2e8f0', icon: '' },
}

// ─── Node renderer ──────────────────────────────────────────────────
function OutlineNode({
  node,
  depth,
  collapsed,
  onToggle,
}: {
  node: TreeNode
  depth: number
  collapsed: Set<string>
  onToggle: (id: string) => void
}) {
  const style = CATEGORY_STYLES[node.category] ?? CATEGORY_STYLES.point
  const isRoot = node.category === 'root'
  const hasChildren = node.children.length > 0
  const isCollapsed = collapsed.has(node.id)
  const indent = depth * 16

  return (
    <div>
      {/* Node pill */}
      <div
        style={{ paddingLeft: indent }}
        className={hasChildren ? 'cursor-pointer select-none' : ''}
        onClick={hasChildren ? () => onToggle(node.id) : undefined}
      >
        <div
          style={{
            background: style.bg,
            border: style.border ? `1.5px solid ${style.border}` : 'none',
            borderRadius: 8,
            padding: '7px 10px',
            color: isRoot ? '#fff' : '#1a1a2e',
            fontSize: 13,
            fontWeight: isRoot ? 600 : 400,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 1px 3px rgba(0,0,0,0.07)',
          }}
        >
          {style.icon && <span style={{ fontSize: 14 }}>{style.icon}</span>}
          <span style={{ flex: 1 }}>{node.label}</span>
          {hasChildren && (
            isCollapsed
              ? <ChevronRight size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
              : <ChevronDown size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
          )}
        </div>
      </div>

      {/* Children */}
      {hasChildren && !isCollapsed && (
        <div className="mt-1.5 flex flex-col gap-1.5">
          {node.children.map(child => (
            <OutlineNode
              key={child.id}
              node={child}
              depth={depth + 1}
              collapsed={collapsed}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Cache helpers ───────────────────────────────────────────────────
type SnapCache = {
  graph: SnapGraph
  messageCount: number
}

function readCache(chatId: string): SnapCache | null {
  try {
    const raw = localStorage.getItem(`snap_cache_${chatId}`)
    return raw ? (JSON.parse(raw) as SnapCache) : null
  } catch {
    return null
  }
}

function writeCache(chatId: string, graph: SnapGraph, messageCount: number) {
  try {
    localStorage.setItem(
      `snap_cache_${chatId}`,
      JSON.stringify({ graph, messageCount } satisfies SnapCache),
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
    if (cache && cache.messageCount === messages.length) {
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
      writeCache(chatId, object as SnapGraph, messages.length)
    }
    wasLoadingRef.current = isLoading
  }, [isLoading, object, chatId, messages.length])

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
  ) as { id: string; label: string; category: 'root' | 'agreed' | 'open' | 'next' | 'topic' | 'point' }[]

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
    <div className="h-full w-full relative overflow-y-auto">
      {/* Header row */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-background border-b">
        <span className="text-sm font-semibold text-foreground truncate">
          {activeGraph?.title ?? ''}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRegenerate}
          disabled={cachedGraph !== null}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Regenerate
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && !root && (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-muted-foreground animate-pulse">Generating diagram…</p>
        </div>
      )}

      {/* Outline tree */}
      {root && (
        <div className="flex flex-col gap-1.5 p-4">
          <OutlineNode
            node={root}
            depth={0}
            collapsed={collapsed}
            onToggle={toggleCollapse}
          />
        </div>
      )}

      {/* Orphan nodes (disconnected from root) */}
      {orphans.length > 0 && (
        <div className="px-4 pb-4">
          <div className="border-t my-3" />
          <div className="flex flex-col gap-1.5">
            {orphans.map(n => (
              <OutlineNode
                key={n.id}
                node={n}
                depth={0}
                collapsed={collapsed}
                onToggle={toggleCollapse}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
