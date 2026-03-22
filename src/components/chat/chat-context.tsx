"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { DEFAULT_MODEL_ID } from "@/lib/models";

type ViewType = "chat" | "graph";

interface ChatContextType {
  activeModel: string;
  setActiveModel: (model: string) => void;
  view: ViewType;
  setView: (view: ViewType) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [activeModel, setActiveModel] = useState<string>(DEFAULT_MODEL_ID);
  const [view, setView] = useState<ViewType>("chat");

  return (
    <ChatContext.Provider value={{ activeModel, setActiveModel, view, setView }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
}
