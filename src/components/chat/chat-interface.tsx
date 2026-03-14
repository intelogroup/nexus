"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { ChatArea } from "./chat-area";

export function ChatInterface() {
  const [activeModel, setActiveModel] = useState<string>("gpt-4o");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col h-full w-full">
        <Topbar 
          activeModel={activeModel} 
          onModelChange={setActiveModel} 
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />
        <main className="flex-1 relative overflow-hidden">
          <ChatArea activeModel={activeModel} />
        </main>
      </div>
    </div>
  );
}