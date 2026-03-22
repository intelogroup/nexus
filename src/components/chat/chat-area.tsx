"use client";

import { useChat } from "ai/react";
import { useRef, useEffect, useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ContextVisualizer } from "./context-visualizer";
import { createClient } from "@/lib/supabase/client";
import { useChatContext } from "./chat-context";
import { ChatExportMenu } from "./chat-export-menu";

interface ChatAreaProps {
  activeModel?: string; // Optional prop to override context
  chatId: string | null;
  initialMessages?: any[];
  onChatCreated?: (chatId: string) => void;
}

export function ChatArea({ activeModel: modelProp, chatId, initialMessages = [], onChatCreated }: ChatAreaProps) {
  const { activeModel: contextModel, setActiveModel } = useChatContext();
  const activeModel = contextModel || modelProp;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const subscriptionRef = useRef<any>(null);
  
  // Track the last chatId we successfully loaded to prevent redundant fetches
  const lastLoadedChatId = useRef<string | null>(null);
  
  // Track pending chat ID for navigation after stream completes
  const pendingChatIdRef = useRef<string | null>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages } = useChat({
    api: "/api/chat",
    initialMessages,
    body: {
      model: activeModel,
      chatId,
    },
    onResponse: (response) => {
      const id = response.headers.get("x-chat-id");
      if (id && id !== chatId) {
        if (id === 'test-chat-id') {
          if (onChatCreated) onChatCreated(id);
          return;
        }

        // Store the pending chat ID — navigation happens in onFinish after stream completes
        pendingChatIdRef.current = id;
        if (onChatCreated) onChatCreated(id);
      }
    },
    onFinish: () => {
      // Navigate to the new chat AFTER the stream completes
      if (pendingChatIdRef.current && pendingChatIdRef.current !== chatId) {
        router.push(`/chats/${pendingChatIdRef.current}`);
        pendingChatIdRef.current = null;
      }
    },
    onError: (error) => {
      setErrorMessage(error?.message || "Chat request failed.");
      pendingChatIdRef.current = null;
    },
  });

  // Sync context model if the prop changes (e.g. from server render or navigation)
  const lastSyncedModelProp = useRef<string | null>(null);
  useEffect(() => {
    if (modelProp && modelProp !== lastSyncedModelProp.current) {
      setActiveModel(modelProp);
      lastSyncedModelProp.current = modelProp;
    }
  }, [modelProp, setActiveModel]);

  // Sync initialMessages when they change
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages);
      lastLoadedChatId.current = chatId;
    } else if (!chatId && lastLoadedChatId.current !== null) {
      // Only reset if we actually had a chat and now we don't
      setMessages([]);
      lastLoadedChatId.current = null;
    }
  }, [initialMessages, chatId, setMessages]);

  // Load existing messages when chatId changes (as fallback or if not pre-fetched)
  useEffect(() => {
    if (chatId) {
      // Skip fetch for test-chat-id
      if (chatId === 'test-chat-id') return;

      // If we don't have initial messages AND we haven't already loaded this chat
      const shouldFetch = (!initialMessages || initialMessages.length === 0) && lastLoadedChatId.current !== chatId;

      if (shouldFetch) {
        const fetchMessages = async () => {
          try {
            const response = await fetch(`/api/chats/${chatId}/messages`);
            if (response.ok) {
              const data = await response.json();
              setMessages(data);
              lastLoadedChatId.current = chatId;
            }
          } catch {
            // fetch failure — user can retry by navigating back
          }
        };
        fetchMessages();
      }

      // Subscribe to real-time updates for this chat
      // Only create a new subscription if we don't already have one for this chat
      if (subscriptionRef.current?.topic !== `realtime:chat:${chatId}`) {
        // Clean up any existing subscription first
        if (subscriptionRef.current) {
          supabase.removeChannel(subscriptionRef.current);
          subscriptionRef.current = null;
        }

        const channel = supabase
          .channel(`chat:${chatId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
              filter: `chat_id=eq.${chatId}`,
            },
            (payload) => {
              const newMessage = payload.new as any;
              const messageId = newMessage.id.toString();

              // Use functional update to access current state and prevent duplicates
              setMessages((currentMessages) => {
                // Check if message already exists
                if (currentMessages.some((m) => m.id === messageId)) {
                  return currentMessages; // No update needed
                }

                // Add new message
                return [
                  ...currentMessages,
                  {
                    id: messageId,
                    role: newMessage.sender_role,
                    content: newMessage.content,
                    createdAt: newMessage.created_at,
                    model_used: newMessage.model_used ?? undefined,
                  },
                ];
              });
            }
          )
          .subscribe();

        subscriptionRef.current = channel;
      }

      return () => {
        if (subscriptionRef.current) {
          supabase.removeChannel(subscriptionRef.current);
          subscriptionRef.current = null;
        }
      };
    }
  }, [chatId, setMessages, supabase, initialMessages]);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full w-full bg-background">
      {/* Export bar — only show when there are messages and a chat */}
      {chatId && messages.length > 0 && (
        <div className="flex items-center justify-end px-4 sm:px-6 pt-2">
          <ChatExportMenu messages={messages} />
        </div>
      )}
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
            messages.map((m, index) => {
              const prevMessage = index > 0 ? messages[index - 1] : null;
              
              // Helper to extract model from various possible message structures
              const getModel = (msg: any) => {
                if (!msg) return null;
                return msg.model_used || 
                  msg.annotations?.find((a: any) => a.model_used)?.model_used ||
                  msg.data?.find((a: any) => a.model_used)?.model_used;
              };

              let currentModel = getModel(m);
              const prevModel = getModel(prevMessage);

              // If it's an assistant message currently being generated/streamed and has no model info yet,
              // we can assume it's using the activeModel.
              if (!currentModel && m.role === 'assistant' && index === messages.length - 1) {
                currentModel = activeModel;
              }

              // If it's a user message, we assume it was intended for the activeModel 
              // (or the model that the FOLLOWING assistant message will use)
              if (!currentModel && m.role === 'user') {
                // If there's a next message (assistant), use its model
                const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
                const nextModel = getModel(nextMessage);
                currentModel = nextModel || activeModel;
              }

              const showModelChange = currentModel && prevModel && currentModel !== prevModel;

              return (
                <div key={m.id} className="flex flex-col gap-6">
                  {showModelChange && (
                    <div 
                      className="flex items-center gap-4 py-2" 
                      data-testid="model-change-line"
                      data-from={prevModel}
                      data-to={currentModel}
                    >
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                        Model change from <span className="text-primary">{prevModel}</span> to <span className="text-primary">{currentModel}</span>
                      </span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}
                  <div
                    data-testid="chat-message"
                    data-message-role={m.role}
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
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="p-4 bg-background border-t">
        <div className="max-w-3xl mx-auto flex flex-col gap-3">
          {errorMessage ? (
            <div
              role="alert"
              data-testid="chat-error"
              className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {errorMessage}
            </div>
          ) : null}
          <ContextVisualizer messages={messages} activeModel={activeModel ?? ''} />
          <form
            onSubmit={(event) => {
              setErrorMessage(null);
              handleSubmit(event, {
                body: {
                  model: activeModel,
                  chatId,
                }
              });
            }}
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
