"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Sidebar } from "./sidebar";
import { DEFAULT_MODEL_ID } from "@/lib/models";
import { Topbar } from "./topbar";
import { ChatArea } from "./chat-area";

const KnowledgeGraph = dynamic(() => import("./knowledge-graph").then(mod => mod.KnowledgeGraph), {
  loading: () => (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">Loading Neural Network...</p>
    </div>
  ),
  ssr: false,
});

interface ChatInterfaceProps {
  initialChats?: any[];
}

export function ChatInterface({ initialChats = [] }: ChatInterfaceProps) {
  const [activeModel, setActiveModel] = useState<string>(DEFAULT_MODEL_ID);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [view, setView] = useState<"chat" | "graph" | "snap">("chat");
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const handleChatSelect = (chatId: string | null) => {
    setSelectedChatId(chatId);
    setSidebarOpen(false);
    setView("chat");
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        selectedChatId={selectedChatId}
        onChatSelect={handleChatSelect}
        initialChats={initialChats}
        onChatDeleted={(id) => {
          if (id === selectedChatId) setSelectedChatId(null);
        }}
      />
      
      <div className="flex-1 flex flex-col h-full w-full">
        <Topbar 
          activeModel={activeModel} 
          onModelChange={setActiveModel} 
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          currentView={view}
          onViewChange={setView}
        />
        <main className="flex-1 relative overflow-hidden">
          {view === "chat" ? (
            <ChatArea 
              activeModel={activeModel} 
              chatId={selectedChatId} 
              onChatCreated={setSelectedChatId}
            />
          ) : (
            <div className="h-full w-full p-4 lg:p-8 overflow-auto">
              <KnowledgeGraph />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
