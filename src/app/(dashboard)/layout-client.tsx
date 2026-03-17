"use client";

import { useState } from "react";
import { Sidebar } from "@/components/chat/sidebar";
import { Topbar } from "@/components/chat/topbar";
import { ChatProvider, useChatContext } from "@/components/chat/chat-context";
import { MountedOnly } from "@/components/mounted-only";
import { usePathname, useRouter } from "next/navigation";

interface LayoutClientProps {
  children: React.ReactNode;
  initialChats: any[];
}

function LayoutContent({ children, initialChats }: LayoutClientProps) {
  const { activeModel, setActiveModel } = useChatContext();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const currentView = pathname === "/graph" ? "graph" : pathname === "/snap" ? "snap" : "chat";

  const handleViewChange = (view: "chat" | "graph" | "snap") => {
    if (view === "graph") {
      router.push("/graph");
    } else if (view === "snap") {
      // Extract chatId from current pathname /chats/[id] if present
      const chatIdMatch = pathname.match(/^\/chats\/([^/]+)/)
      const chatId = chatIdMatch?.[1]
      router.push(chatId ? `/snap?chatId=${chatId}` : "/snap")
    } else {
      router.push("/");
    }
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        initialChats={initialChats}
      />
      
      <div className="flex-1 flex flex-col h-full w-full">
        <Topbar 
          activeModel={activeModel} 
          onModelChange={setActiveModel} 
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          currentView={currentView}
          onViewChange={handleViewChange}
        />
        <main className="flex-1 relative overflow-hidden">
          <MountedOnly>
            {children}
          </MountedOnly>
        </main>
      </div>
    </div>
  );
}

export function LayoutClient(props: LayoutClientProps) {
  return (
    <ChatProvider>
      <LayoutContent {...props} />
    </ChatProvider>
  );
}
