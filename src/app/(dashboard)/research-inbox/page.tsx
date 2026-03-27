"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Inbox,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Moon,
  ChevronDown,
  ChevronUp,
  Loader2,
  Sparkles,
  AlertTriangle,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ResearchGoal {
  id: string;
  title: string;
  instructions: string | null;
  status: string;
  goal_type: string;
  confidence: number;
  run_at: string | null;
  result_report_id: string | null;
  feedback: number | null;
  created_at: string;
  gap: {
    id: string;
    topic: string;
    gap_description: string;
  } | null;
}

type StatusFilter = "proposed" | "approved" | "running" | "completed" | "all";
type WhenOption = "now" | "in_5h" | "tonight";

// ── Goal Card ──────────────────────────────────────────────────────────────────

function GoalCard({
  goal,
  onApproved,
  onDismissed,
}: {
  goal: ResearchGoal;
  onApproved: (id: string) => void;
  onDismissed: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [when, setWhen] = useState<WhenOption>("now");
  const [instructions, setInstructions] = useState(goal.instructions ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confidencePct = Math.round((goal.confidence ?? 0) * 100);

  async function handleApprove() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/research-goals/${goal.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          when,
          instructions: instructions.trim() || undefined,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Failed (${res.status})`);
        return;
      }
      onApproved(goal.id);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDismiss() {
    setLoading(true);
    setError(null);
    try {
      // Send negative feedback to dismiss the proposed goal
      await fetch(`/api/research-goals/${goal.id}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: -1 }),
      });
      onDismissed(goal.id);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const statusColor: Record<string, string> = {
    proposed: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    approved: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    running: "bg-purple-500/10 text-purple-600 border-purple-500/30",
    completed: "bg-green-500/10 text-green-600 border-green-500/30",
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-medium leading-snug">{goal.title}</h3>
            <Badge
              variant="outline"
              className={statusColor[goal.status] ?? ""}
            >
              {goal.status}
            </Badge>
          </div>
          {goal.gap?.topic && (
            <p className="text-xs text-muted-foreground">
              Topic: {goal.gap.topic}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary" className="text-xs">
            {confidencePct}% confidence
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Gap description */}
      {goal.gap?.gap_description && (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {goal.gap.gap_description}
        </p>
      )}

      {/* Expanded: approval controls */}
      {expanded && goal.status === "proposed" && (
        <div className="space-y-3 pt-2 border-t">
          {/* When selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              When should the agent run this research?
            </label>
            <div className="flex gap-2">
              {(
                [
                  { value: "now", label: "Now", icon: Zap },
                  { value: "in_5h", label: "In 5 hours", icon: Clock },
                  { value: "tonight", label: "Tonight", icon: Moon },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  variant={when === value ? "secondary" : "outline"}
                  size="sm"
                  className="h-8 gap-1.5 text-xs"
                  onClick={() => setWhen(value)}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Additional instructions (optional)
            </label>
            <Textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Focus on..., include..., compare with..."
              rows={2}
              className="text-sm resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertTriangle className="h-3.5 w-3.5" />
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="gap-1.5"
              onClick={handleApprove}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Approve
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleDismiss}
              disabled={loading}
            >
              <XCircle className="h-3.5 w-3.5" />
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {/* Status-specific info for non-proposed goals */}
      {goal.status === "approved" && goal.run_at && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3.5 w-3.5" />
          Scheduled for{" "}
          {new Date(goal.run_at).toLocaleString(undefined, {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </p>
      )}

      {goal.status === "running" && (
        <p className="text-xs text-purple-600 flex items-center gap-1">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Research in progress...
        </p>
      )}

      {goal.status === "completed" && goal.result_report_id && (
        <p className="text-xs text-green-600 flex items-center gap-1">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Completed — report available
        </p>
      )}

      {/* Timestamp */}
      <p className="text-[11px] text-muted-foreground">
        Suggested{" "}
        {new Date(goal.created_at).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </p>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default function ResearchInboxPage() {
  const [goals, setGoals] = useState<ResearchGoal[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("proposed");

  const fetchGoals = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const status =
        filter === "all"
          ? "proposed,approved,running,completed"
          : filter;
      const res = await fetch(
        `/api/research-inbox?status=${status}&limit=50`
      );
      if (res.ok) {
        const data = await res.json();
        setGoals(data.goals ?? []);
        setTotal(data.total ?? 0);
      } else {
        setFetchError(`Failed to load goals (${res.status})`);
      }
    } catch (err) {
      console.warn("[ResearchInbox] Failed to fetch goals:", err);
      setFetchError("Network error — could not load research goals.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  function handleApproved(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    setTotal((prev) => Math.max(0, prev - 1));
  }

  function handleDismissed(id: string) {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    setTotal((prev) => Math.max(0, prev - 1));
  }

  const proposedCount = goals.filter((g) => g.status === "proposed").length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
        <div className="flex items-center gap-3">
          <Inbox className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold">Research Inbox</h1>
            <p className="text-xs text-muted-foreground">
              {total} goal{total !== 1 ? "s" : ""}{" "}
              {filter === "proposed" && "awaiting review"}
              {filter === "approved" && "approved"}
              {filter === "running" && "in progress"}
              {filter === "completed" && "completed"}
              {filter === "all" && "total"}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchGoals}>
          Refresh
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 px-6 py-2 border-b bg-muted/30 overflow-x-auto shrink-0">
        {(
          [
            { value: "proposed", label: "Pending", icon: Sparkles },
            { value: "approved", label: "Approved", icon: Clock },
            { value: "running", label: "Running", icon: Loader2 },
            { value: "completed", label: "Completed", icon: CheckCircle2 },
            { value: "all", label: "All", icon: Inbox },
          ] as const
        ).map(({ value, label, icon: Icon }) => (
          <Button
            key={value}
            variant={filter === value ? "secondary" : "ghost"}
            size="sm"
            className="h-8 gap-1.5 text-xs shrink-0"
            onClick={() => setFilter(value)}
          >
            <Icon
              className={`h-3.5 w-3.5 ${
                value === "running" && filter === value ? "animate-spin" : ""
              }`}
            />
            {label}
          </Button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive/40 mb-3" />
            <p className="text-sm text-destructive">{fetchError}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={fetchGoals}>
              Try again
            </Button>
          </div>
        ) : goals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Inbox className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              {filter === "proposed"
                ? "No pending research goals. The agent scans twice daily."
                : `No ${filter} goals found.`}
            </p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-3">
            {goals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onApproved={handleApproved}
                onDismissed={handleDismissed}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
