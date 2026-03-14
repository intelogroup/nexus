"use client";

import { useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { estimateTokens, MODEL_LIMITS } from "@/lib/tokens";
import { Message } from "ai";

interface ContextVisualizerProps {
  messages: Message[];
  activeModel: string;
}

export function ContextVisualizer({ messages, activeModel }: ContextVisualizerProps) {
  const tokenCount = useMemo(() => {
    // A simple sum of estimated tokens for all messages
    const textContent = messages.map(m => m.content).join(" ");
    return estimateTokens(textContent);
  }, [messages]);

  const limit = MODEL_LIMITS[activeModel] || 128000;
  const percentage = Math.min((tokenCount / limit) * 100, 100);

  // Formatting large numbers, e.g., 128k
  const formatTokens = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num.toString();
  };

  return (
    <div className="flex flex-col gap-1.5 w-full max-w-xs text-xs text-muted-foreground">
      <div className="flex justify-between items-center">
        <span>Context Usage</span>
        <span>
          {formatTokens(tokenCount)} / {formatTokens(limit)}
        </span>
      </div>
      <Progress value={percentage} className="h-1.5" />
    </div>
  );
}