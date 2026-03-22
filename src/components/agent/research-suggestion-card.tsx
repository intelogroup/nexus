"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Clock, Zap, Moon, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, Minus } from "lucide-react";

export interface ResearchNotification {
  id: string;
  type: string;
  status: string;
  created_at: string;
  payload: {
    goal_id: string;
    gap_id?: string;
    report_id?: string;
    title: string;
    topic?: string;
    summary: string;
    source: string;
    confidence: number;
    finding_count?: number;
    new_node_count?: number;
  };
}

type WhenOption = "now" | "in_5h" | "tonight";

interface ResearchSuggestionCardProps {
  notification: ResearchNotification;
  onApproved: (notificationId: string) => void;
  onDismiss: (notificationId: string) => void;
}

export function ResearchSuggestionCard({
  notification,
  onApproved,
  onDismiss,
}: ResearchSuggestionCardProps) {
  const { payload } = notification;
  const [expanded, setExpanded] = useState(false);
  const [when, setWhen] = useState<WhenOption>("now");
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<1 | 0 | -1 | null>(null);
  const [feedbackSent, setFeedbackSent] = useState(false);

  async function sendFeedback(value: 1 | 0 | -1) {
    if (feedbackSent) return;
    setFeedback(value);
    setFeedbackSent(true);
    await fetch(`/api/research-goals/${payload.goal_id}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feedback: value }),
    }).catch((err) => {
      console.warn('[ResearchSuggestionCard] Failed to send feedback:', err);
    });
  }

  async function handleApprove() {
    setLoading(true);
    try {
      const res = await fetch(`/api/research-goals/${payload.goal_id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ when, instructions: instructions.trim() || undefined }),
      });
      if (res.ok) {
        await fetch("/api/notifications", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: notification.id }),
        });
        onApproved(notification.id);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDismiss() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: notification.id }),
    });
    onDismiss(notification.id);
  }

  const confidencePct = Math.round((payload.confidence ?? 0) * 100);

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2 text-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5 flex-1 min-w-0">
          <p className="font-medium leading-snug truncate">{payload.title}</p>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-xs px-1.5 py-0 h-4">
              {payload.topic}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {confidencePct}% confidence
            </span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">
              Based on your conversations
            </span>
          </div>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Summary */}
      <p className="text-muted-foreground leading-relaxed">{payload.summary}</p>

      {/* Expanded: instructions + time picker */}
      {expanded && (
        <div className="space-y-2 pt-1">
          <Textarea
            placeholder="Add specific instructions or focus areas (optional)"
            className="text-xs min-h-[60px] resize-none"
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            maxLength={2000}
          />

          {/* When to run */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWhen("now")}
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs border transition-colors ${
                when === "now"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-foreground/40"
              }`}
            >
              <Zap className="h-3 w-3" />
              Now
            </button>
            <button
              onClick={() => setWhen("in_5h")}
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs border transition-colors ${
                when === "in_5h"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-foreground/40"
              }`}
            >
              <Clock className="h-3 w-3" />
              In 5 hrs
            </button>
            <button
              onClick={() => setWhen("tonight")}
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs border transition-colors ${
                when === "tonight"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-foreground/40"
              }`}
            >
              <Moon className="h-3 w-3" />
              Tonight
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-0.5">
        <div className="flex items-center gap-1">
          <button
            onClick={() => sendFeedback(1)}
            disabled={feedbackSent}
            className={`p-1 rounded transition-colors disabled:opacity-50 ${
              feedback === 1 ? "text-green-500" : "text-muted-foreground hover:text-green-500"
            }`}
            title="Good suggestion"
          >
            <ThumbsUp className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => sendFeedback(0)}
            disabled={feedbackSent}
            className={`p-1 rounded transition-colors disabled:opacity-50 ${
              feedback === 0 ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
            title="Neutral"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => sendFeedback(-1)}
            disabled={feedbackSent}
            className={`p-1 rounded transition-colors disabled:opacity-50 ${
              feedback === -1 ? "text-red-500" : "text-muted-foreground hover:text-red-500"
            }`}
            title="Not relevant"
          >
            <ThumbsDown className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={handleDismiss}
            disabled={loading}
          >
            Dismiss
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              if (!expanded) setExpanded(true);
              else handleApprove();
            }}
            disabled={loading}
          >
            {loading ? "Scheduling…" : expanded ? "Approve" : "Review"}
          </Button>
        </div>
      </div>
    </div>
  );
}
