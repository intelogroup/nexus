'use client'

import { useState } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { ChevronRight, Trash2 } from 'lucide-react'

export type FlowNodeData = {
  label: string
  category: 'root' | 'agreed' | 'open' | 'next' | 'topic' | 'point'
  description?: string
  connectedLabels: string[]
  onDelete: (id: string) => void
}

const CATEGORY_ICONS: Record<string, string> = {
  root:   '🗨',
  agreed: '✅',
  open:   '⚠️',
  next:   '➡',
  topic:  '💡',
  point:  '•',
}

// Pure helper — exported for testing
export function formatConnectedLabels(labels: string[]): string | null {
  if (labels.length === 0) return null
  return `Connects to: ${labels.join(', ')}`
}

export function FlowNode({ id, data }: NodeProps<Node<FlowNodeData>>) {
  const [expanded, setExpanded] = useState(false)
  const icon = CATEGORY_ICONS[data.category] ?? '•'
  const connected = formatConnectedLabels(data.connectedLabels)

  return (
    <div className="bg-white border border-border rounded-xl shadow-sm px-3 py-2 min-w-[180px] max-w-[240px]">
      <Handle type="target" position={Position.Top} className="opacity-0" />

      {/* Main row */}
      <div className="flex items-center gap-2">
        <span className="text-sm flex-shrink-0">{icon}</span>
        <span className="text-sm font-medium flex-1 leading-tight">{data.label}</span>
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Expand node"
        >
          <ChevronRight
            size={14}
            className={`transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
        </button>
        <button
          onClick={() => data.onDelete(id)}
          className="flex-shrink-0 text-muted-foreground hover:text-destructive transition-colors"
          aria-label="Delete node"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="mt-2 pt-2 border-t border-border/50 flex flex-col gap-1">
          <p className="text-xs text-muted-foreground leading-snug">
            {data.description ?? 'No description available.'}
          </p>
          {connected && (
            <p className="text-xs text-muted-foreground italic">{connected}</p>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  )
}
