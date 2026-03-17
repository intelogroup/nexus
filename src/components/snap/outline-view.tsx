'use client'

import { ChevronDown, ChevronRight } from 'lucide-react'
import type { TreeNode } from './snap-tree'

type CategoryStyle = { bg: string; border?: string; icon: string }

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  root:   { bg: '#1a1a2e',                    icon: '🗨' },
  agreed: { bg: '#dcfce7', border: '#22c55e', icon: '✅' },
  open:   { bg: '#fef9c3', border: '#eab308', icon: '⚠️' },
  next:   { bg: '#dbeafe', border: '#3b82f6', icon: '➡' },
  topic:  { bg: '#f3e8ff', border: '#a855f7', icon: '💡' },
  point:  { bg: '#f8fafc', border: '#e2e8f0', icon: '' },
}

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

export interface OutlineViewProps {
  root: TreeNode | null
  orphans: TreeNode[]
  isLoading: boolean
  collapsed: Set<string>
  onToggle: (id: string) => void
}

export function OutlineView({ root, orphans, isLoading, collapsed, onToggle }: OutlineViewProps) {
  return (
    <>
      {isLoading && !root && (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-muted-foreground animate-pulse">Generating diagram…</p>
        </div>
      )}

      {root && (
        <div className="flex flex-col gap-1.5 p-4">
          <OutlineNode
            node={root}
            depth={0}
            collapsed={collapsed}
            onToggle={onToggle}
          />
        </div>
      )}

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
                onToggle={onToggle}
              />
            ))}
          </div>
        </div>
      )}
    </>
  )
}
