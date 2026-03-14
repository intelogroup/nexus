"use client";

import { useChat } from "ai/react";
import { useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ContextVisualizer } from "./context-visualizer";

interface ChatAreaProps {
  activeModel: string;
}

export function ChatArea({ activeModel }: ChatAreaProps) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/chat",
    body: {
      model: activeModel,
    },
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full w-full bg-background">
      <div className="flex-1 overflow-y-auto p-4 sm:p-6" ref={scrollRef}>
        <div className="flex flex-col gap-6 max-w-3xl mx-auto pb-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4 text-muted-foreground">
              <Avatar className="h-12 w-12">
                <AvatarFallback>AI</AvatarFallback>
              </Avatar>
              <p>How can I help you today?</p>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-4 ${
                  m.role === "user" ? "flex-row-reverse" : "flex-row"
                }`}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  {m.role === "user" ? (
                    <AvatarFallback>U</AvatarFallback>
                  ) : (
                    <AvatarFallback>AI</AvatarFallback>
                  )}
                </Avatar>
                <div
                  className={`flex flex-col max-w-[80%] ${
                    m.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`rounded-xl px-5 py-3 text-sm shadow-sm ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted border border-border/50"
                    }`}
                  >
                    <div className={`prose prose-sm max-w-none break-words ${
                      m.role === "user" ? "prose-invert" : "dark:prose-invert"
                    }`}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="p-4 bg-background border-t">
        <div className="max-w-3xl mx-auto flex flex-col gap-3">
          <ContextVisualizer messages={messages} activeModel={activeModel} />
          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-2"
          >
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder="Message OmniChat..."
              className="flex-1 h-12 rounded-full px-5"
              disabled={isLoading}
            />
            <Button type="submit" size="icon" className="h-12 w-12 rounded-full shrink-0" disabled={isLoading || !input.trim()}>
              <Send className="h-5 w-5" />
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}