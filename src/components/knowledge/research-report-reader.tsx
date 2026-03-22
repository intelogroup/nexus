'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileText, Loader2, ChevronRight, ArrowLeft, ArrowRight, Brain, AlertCircle, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ResearchReportModal } from '@/components/agent/research-report-modal'

// ─── Types ───────────────────────────────────────────────────────────
interface KeyClaim {
  claim: string
  confidence: number
  source_node_labels?: string[]
}

interface ReportListItem {
  id: string
  goal_id: string
  goal_title: string
  summary: string
  key_claims: KeyClaim[]
  confidence: number
  model_used: string
  created_at: string
  linked_node_ids: string[]
}

interface ListResponse {
  reports: ReportListItem[]
  total: number
  page: number
  perPage: number
}

// ─── Helpers ─────────────────────────────────────────────────────────
function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function confidenceColor(c: number): string {
  const pct = Math.round(c * 100)
  if (pct >= 80) return 'text-green-600 dark:text-green-400'
  if (pct >= 50) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-500 dark:text-red-400'
}

// ─── Main component ──────────────────────────────────────────────────
export function ResearchReportReader() {
  const [reports, setReports] = useState<ReportListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [perPage] = useState(20)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Detail modal state
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)
  const [selectedGoalTitle, setSelectedGoalTitle] = useState('')

  const fetchReports = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('per_page', String(perPage))
      params.set('status', 'completed')

      const res = await fetch(`/api/research-reports?${params}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data: ListResponse = await res.json()
      setReports(data.reports)
      setTotal(data.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [page, perPage])

  useEffect(() => {
    fetchReports()
  }, [fetchReports])

  const totalPages = Math.ceil(total / perPage)

  const openReport = (report: ReportListItem) => {
    setSelectedReportId(report.id)
    setSelectedGoalTitle(report.goal_title)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Brain size={18} className="text-primary" />
          <h1 className="text-sm font-semibold">Research Reports</h1>
          <span className="text-xs text-muted-foreground">
            {total} report{total !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && reports.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle size={16} />
              {error}
            </div>
            <Button variant="outline" size="sm" onClick={fetchReports}>Retry</Button>
          </div>
        )}

        {!loading && !error && reports.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <FileText size={32} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No completed research reports yet.
            </p>
            <p className="text-xs text-muted-foreground">
              Reports appear here after your approved research goals are executed.
            </p>
          </div>
        )}

        {reports.map(report => (
          <Card
            key={report.id}
            className="p-4 cursor-pointer hover:bg-muted/30 transition-colors group"
            onClick={() => openReport(report)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {/* Title */}
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={14} className="text-primary shrink-0" />
                  <h3 className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                    {report.goal_title}
                  </h3>
                </div>

                {/* Summary preview */}
                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                  {report.summary}
                </p>

                {/* Metadata row */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className={confidenceColor(report.confidence)}>
                    {Math.round(report.confidence * 100)}% confidence
                  </span>
                  <span>{report.key_claims?.length ?? 0} findings</span>
                  <span>{report.linked_node_ids?.length ?? 0} linked nodes</span>
                  <span>{formatDate(report.created_at)}</span>
                  <Badge variant="outline" className="text-[10px]">{report.model_used}</Badge>
                </div>
              </div>

              <ChevronRight size={16} className="text-muted-foreground shrink-0 mt-1 group-hover:text-primary transition-colors" />
            </div>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t bg-background">
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ArrowLeft size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* Detail modal (reuses existing research-report-modal) */}
      <ResearchReportModal
        reportId={selectedReportId}
        goalTitle={selectedGoalTitle}
        open={!!selectedReportId}
        onClose={() => setSelectedReportId(null)}
      />
    </div>
  )
}
