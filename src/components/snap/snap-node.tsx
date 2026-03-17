import { type NodeProps } from '@xyflow/react'

const CATEGORY_STYLES: Record<string, { bg: string; border: string; icon: string }> = {
  root:    { bg: '#1a1a2e', border: 'none',    icon: '🗨' },
  agreed:  { bg: '#dcfce7', border: '#22c55e', icon: '✅' },
  open:    { bg: '#fef9c3', border: '#eab308', icon: '⚠️' },
  next:    { bg: '#dbeafe', border: '#3b82f6', icon: '➡' },
  topic:   { bg: '#f3e8ff', border: '#a855f7', icon: '' },
  point:   { bg: '#f8fafc', border: '#e2e8f0', icon: '' },
}

export type SnapNodeData = {
  label: string
  category: 'root' | 'agreed' | 'open' | 'next' | 'topic' | 'point'
}

export function SnapNode({ data }: NodeProps) {
  const nodeData = data as SnapNodeData
  const style = CATEGORY_STYLES[nodeData.category] ?? CATEGORY_STYLES.point
  const isRoot = nodeData.category === 'root'

  return (
    <div
      style={{
        background: style.bg,
        border: style.border !== 'none' ? `1.5px solid ${style.border}` : 'none',
        borderRadius: 8,
        padding: '8px 12px',
        minWidth: 120,
        maxWidth: 160,
        color: isRoot ? '#fff' : '#1a1a2e',
        fontSize: 12,
        fontWeight: isRoot ? 600 : 400,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      }}
    >
      {style.icon && <span style={{ fontSize: 14 }}>{style.icon}</span>}
      <span>{nodeData.label}</span>
    </div>
  )
}
