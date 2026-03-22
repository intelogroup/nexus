'use client'

import { useEffect, useState } from 'react'
import { X, Loader2, Link2, MessageSquare, FileText, ArrowRight, ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

// ─── Types ───────────────────────────────────────────────────────────
interface RelatedNode {
  id: string
  label: string
  node_type: string
  relation: string
  weight: number
  direction: 'in' | 'out'
}

interface SourceMessage {
  id: string
  content: string
  role: string
  created_at: string
  chat_id: string
}

interface LinkedReport {
  id: string
  summary: string
  confidence: number
  created_at: string
  goal_id: string
}

interface NodeDetail {
  id: string
  label: string | null
  summary: string | null
  node_type: string | null
  importance_score: number
  mention_count: number
  edge_count: number
  created_at: string | null
  updated_at: string | null
  chat_id: string | null
  message_id: string | null
  visibility: string | null
  source_type: string | null
  domain_id: string | null
  parent_node_id: string | null
  level: number | null
}

interface NodeDetailResponse {
  node: NodeDetail
  related: RelatedNode[]
  sourceMessage: SourceMessage | null
  reports: LinkedReport[]
}

// ─── Badge colors ────────────────────────────────────────────────────
const NODE_TYPE_COLORS: Record<string, string> = {
  technology:       'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  concept:          'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  person:           'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  organization:     'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  workflow:         'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  outcome:          'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  knowledge_gap:    'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  research_finding: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
}

function getNodeTypeBadgeClass(nodeType: string | null): string {
  return NODE_TYPE_COLORS[nodeType ?? ''] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--'
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Props ───────────────────────────────────────────────────────────
interface KnowledgeNodeDetailProps {
  nodeId: string | null
  onClose: () => void
  onNavigateToNode?: (nodeId: string) => void
}

export function KnowledgeNodeDetail({ nodeId, onClose, onNavigateToNode }: KnowledgeNodeDetailProps) {
  const [data, setData] = useState<NodeDetailResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!nodeId) return
    setLoading(true)
    setError(null)
    setData(null)

    fetch(`/api/knowledge/nodes/${nodeId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setData(d as NodeDetailResponse)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [nodeId])

  if (!nodeId) return null

  return (
    <div className="fixed inset-y-0 right-0 w-full max-w-md bg-background border-l shadow-lg z-50 flex flex-col" data-testid="node-detail-panel">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-sm font-semibold truncate">Node Detail</h2>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
          <X size={16} />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="text-sm text-destructive py-4">{error}</div>
        )}

        {data && (
          <>
            {/* Title & type */}
            <div>
              <h3 className="text-lg font-semibold leading-tight">{data.node.label ?? '(untitled)'}</h3>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge variant="secondary" className={`text-xs ${getNodeTypeBadgeClass(data.node.node_type)}`}>
                  {(data.node.node_type ?? 'unknown').replace(/_/g, ' ')}
                </Badge>
                <span className="text-xs text-muted-foreground">Score: {data.node.importance_score.toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">{data.node.mention_count} mentions</span>
              </div>
            </div>

            {/* Summary */}
            {data.node.summary && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Summary</p>
                <p className="text-sm leading-relaxed">{data.node.summary}</p>
              </div>
            )}

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div>Source: {data.node.source_type ?? 'unknown'}</div>
              <div>Visibility: {data.node.visibility ?? 'private'}</div>
              <div>Created: {formatDate(data.node.created_at)}</div>
              <div>Updated: {formatDate(data.node.updated_at)}</div>
            </div>

            <Separator />

            {/* Source Message */}
            {data.sourceMessage && (
              <>
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    <MessageSquare size={12} />
                    Source Message
                  </div>
                  <Card className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px]">{data.sourceMessage.role}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(data.sourceMessage.created_at)}</span>
                    </div>
                    <p className="text-sm line-clamp-6">{data.sourceMessage.content}</p>
                  </Card>
                </div>
                <Separator />
              </>
            )}

            {/* Related Nodes */}
            {data.related.length > 0 && (
              <>
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    <Link2 size={12} />
                    Related Nodes ({data.related.length})
                  </div>
                  <div className="space-y-1.5">
                    {data.related.map(rn => (
                      <button
                        key={rn.id}
                        onClick={() => onNavigateToNode?.(rn.id)}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-muted/60 transition-colors text-left group"
                      >
                        {rn.direction === 'out' ? (
                          <ArrowRight size={12} className="text-muted-foreground shrink-0" />
                        ) : (
                          <ArrowLeft size={12} className="text-muted-foreground shrink-0" />
                        )}
                        <span className="text-sm truncate flex-1 group-hover:text-primary transition-colors">
                          {rn.label}
                        </span>
                        <Badge variant="secondary" className={`text-[10px] shrink-0 ${getNodeTypeBadgeClass(rn.node_type)}`}>
                          {rn.node_type.replace(/_/g, ' ')}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground shrink-0">{rn.relation.replace(/_/g, ' ')}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <Separator />
              </>
            )}

            {/* Research Reports */}
            {data.reports.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  <FileText size={12} />
                  Research Findings ({data.reports.length})
                </div>
                <div className="space-y-2">
                  {data.reports.map(report => (
                    <Card key={report.id} className="p-3">
                      <p className="text-sm line-clamp-3">{report.summary}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs text-muted-foreground">
                          {Math.round(report.confidence * 100)}% confidence
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(report.created_at)}
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Empty state for related & reports */}
            {data.related.length === 0 && data.reports.length === 0 && !data.sourceMessage && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No connections or research findings yet.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
