"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, CheckCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { ResearchSuggestionCard, type ResearchNotification } from "./research-suggestion-card";
import { ResearchReportModal } from "./research-report-modal";

function GoalCompleteCard({
  notification,
  onDismiss,
  onViewReport,
}: {
  notification: ResearchNotification;
  onDismiss: (id: string) => void;
  onViewReport: (reportId: string, title: string) => void;
}) {
  const { payload } = notification;
  return (
    <div className="rounded-lg border bg-card p-3 space-y-1.5 text-sm">
      <div className="flex items-start gap-2">
        <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium leading-snug">{payload.title}</p>
          <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed line-clamp-2">
            {payload.summary}
          </p>
          {((payload.new_node_count ?? 0) > 0 || (payload.finding_count ?? 0) > 0) && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <Sparkles className="h-3 w-3 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {payload.finding_count ?? 0} finding{(payload.finding_count ?? 0) !== 1 ? "s" : ""}
                {(payload.new_node_count ?? 0) > 0 && ` · ${payload.new_node_count} new concepts`}
              </span>
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">
            Based on your conversations
          </p>
        </div>
        <button
          className="text-muted-foreground hover:text-foreground text-xs shrink-0 mt-0.5"
          onClick={() => onDismiss(notification.id)}
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>

      {payload.report_id && (
        <button
          onClick={() => onViewReport(payload.report_id!, payload.title)}
          className="w-full text-left text-xs text-primary hover:underline pt-0.5"
        >
          View full report →
        </button>
      )}
    </div>
  );
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<ResearchNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [reportModal, setReportModal] = useState<{
    reportId: string;
    goalTitle: string;
  } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const unreadCount = notifications.filter((n) => n.status === "unread").length;

  // Initial fetch
  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => {
        const items = data?.notifications ?? data;
        if (Array.isArray(items)) setNotifications(items);
      })
      .catch((err) => {
        console.warn('[NotificationBell] Failed to fetch notifications:', err);
      });
  }, []);

  // Realtime: pick up both research_suggestion and goal_complete in real time
  useEffect(() => {
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const n = payload.new as ResearchNotification;
          if (n.type === "research_suggestion" || n.type === "goal_complete") {
            setNotifications((prev) => [n, ...prev]);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [supabase]);

  // Close panel on outside click (but not when modal is open)
  useEffect(() => {
    if (!open || reportModal) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, reportModal]);

  function handleApproved(notificationId: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, status: "read" } : n))
    );
  }

  function handleDismiss(notificationId: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  }

  function handleViewReport(reportId: string, goalTitle: string) {
    setOpen(false);
    setReportModal({ reportId, goalTitle });
  }

  return (
    <>
      <div className="relative" ref={panelRef}>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9"
          onClick={() => setOpen((v) => !v)}
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
          )}
        </Button>

        {open && (
          <div className="absolute right-0 top-full mt-2 w-80 z-50 rounded-lg border bg-popover shadow-lg">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <span className="text-sm font-medium">Research Suggestions</span>
              {unreadCount > 0 && (
                <span className="text-xs text-muted-foreground">{unreadCount} new</span>
              )}
            </div>

            <div className="max-h-[480px] overflow-y-auto p-2 space-y-2">
              {notifications.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  No suggestions yet. The agent scans twice daily.
                </p>
              ) : (
                notifications.map((n) => {
                  if (n.type === "research_suggestion") {
                    return (
                      <ResearchSuggestionCard
                        key={n.id}
                        notification={n}
                        onApproved={handleApproved}
                        onDismiss={handleDismiss}
                      />
                    );
                  }
                  if (n.type === "goal_complete") {
                    return (
                      <GoalCompleteCard
                        key={n.id}
                        notification={n}
                        onDismiss={handleDismiss}
                        onViewReport={handleViewReport}
                      />
                    );
                  }
                  return null;
                })
              )}
            </div>
          </div>
        )}
      </div>

      <ResearchReportModal
        reportId={reportModal?.reportId ?? null}
        goalTitle={reportModal?.goalTitle ?? ""}
        open={reportModal !== null}
        onClose={() => setReportModal(null)}
      />
    </>
  );
}
