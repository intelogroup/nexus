"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Brain, Sparkles, FileText, AlertCircle } from "lucide-react";

interface KeyClaim {
  claim: string;
  confidence: number;
  source_node_labels?: string[];
}

interface LinkedNode {
  id: string;
  label: string;
  node_type: string;
}

interface ResearchReport {
  id: string;
  goal_id: string;
  summary: string;
  key_claims: KeyClaim[];
  sources: unknown[];
  linked_nodes: LinkedNode[];
  confidence: number;
  model_used: string;
  created_at: string;
}

interface ResearchReportModalProps {
  reportId: string | null;
  goalTitle: string;
  open: boolean;
  onClose: () => void;
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    pct >= 80 ? "bg-green-500" :
    pct >= 50 ? "bg-yellow-500" :
    "bg-red-400";

  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-8">{pct}%</span>
    </div>
  );
}

const NODE_TYPE_COLORS: Record<string, string> = {
  research_finding: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  concept:          "bg-purple-500/10 text-purple-600 border-purple-500/20",
  technology:       "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  topic:            "bg-orange-500/10 text-orange-600 border-orange-500/20",
  hypothesis:       "bg-pink-500/10 text-pink-600 border-pink-500/20",
};

function nodeTypeClass(type: string) {
  return NODE_TYPE_COLORS[type] ?? "bg-muted text-muted-foreground border-border";
}

export function ResearchReportModal({
  reportId,
  goalTitle,
  open,
  onClose,
}: ResearchReportModalProps) {
  const [report, setReport] = useState<ResearchReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !reportId) return;
    setLoading(true);
    setError(null);
    setReport(null);

    fetch(`/api/research-reports/${reportId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setReport(data as ResearchReport);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open, reportId]);

  const newNodes = report?.linked_nodes.filter(
    (n) => n.node_type === "research_finding"
  ) ?? [];
  const relatedNodes = report?.linked_nodes.filter(
    (n) => n.node_type !== "research_finding"
  ) ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4 text-primary shrink-0" />
            <span className="leading-snug">{goalTitle}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {loading && (
            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
              Loading report…
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive py-4">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {report && (
            <>
              {/* Source badge */}
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="text-xs">
                  Based on your conversations
                </Badge>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground">
                  {Math.round(report.confidence * 100)}% overall confidence
                </span>
              </div>

              {/* Summary */}
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <FileText className="h-3 w-3" />
                  Summary
                </div>
                <p className="text-sm leading-relaxed">{report.summary}</p>
              </div>

              <Separator />

              {/* Key findings */}
              {report.key_claims.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Key Findings
                  </p>
                  <ul className="space-y-2.5">
                    {report.key_claims.map((c, i) => (
                      <li key={i} className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-sm leading-snug">{c.claim}</p>
                          {c.source_node_labels && c.source_node_labels.length > 0 && (
                            <p className="text-xs text-muted-foreground truncate">
                              from: {c.source_node_labels.join(", ")}
                            </p>
                          )}
                        </div>
                        <ConfidenceBar value={c.confidence} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* New concepts added to graph */}
              {newNodes.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      <Sparkles className="h-3 w-3" />
                      Added to your Knowledge Graph
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {newNodes.map((n) => (
                        <span
                          key={n.id}
                          className={`inline-flex items-center px-2 py-0.5 rounded border text-xs capitalize ${nodeTypeClass(n.node_type)}`}
                        >
                          {n.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Related existing concepts */}
              {relatedNodes.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Related Concepts
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {relatedNodes.map((n) => (
                        <span
                          key={n.id}
                          className={`inline-flex items-center px-2 py-0.5 rounded border text-xs capitalize ${nodeTypeClass(n.node_type)}`}
                        >
                          {n.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
