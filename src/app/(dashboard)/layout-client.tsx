"use client";

import { useState } from "react";
import { Sidebar } from "@/components/chat/sidebar";
import { Topbar } from "@/components/chat/topbar";
import { ChatProvider, useChatContext } from "@/components/chat/chat-context";
import { MountedOnly } from "@/components/mounted-only";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

interface LayoutClientProps {
  children: React.ReactNode;
  initialChats: any[];
}

function LayoutContent({ children, initialChats }: LayoutClientProps) {
  const { activeModel, setActiveModel } = useChatContext();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentView = pathname === "/graph" ? "graph" : pathname === "/snap" ? "snap" : pathname === "/knowledge" ? "knowledge" : pathname === "/research-inbox" ? "research-inbox" : pathname === "/reports" ? "reports" : "chat";

  const handleViewChange = (view: "chat" | "graph" | "snap" | "knowledge" | "research-inbox" | "reports") => {
    if (view === "reports") {
      router.push("/reports");
    } else if (view === "research-inbox") {
      router.push("/research-inbox");
    } else if (view === "knowledge") {
      router.push("/knowledge");
    } else if (view === "graph") {
      router.push("/graph");
    } else if (view === "snap") {
      // Try pathname first (/chats/[id]), then fall back to current query param
      // (handles the case where we're already on /snap?chatId=...)
      const chatIdFromPath = pathname.match(/^\/chats\/([^/]+)/)?.[1]
      const chatId = chatIdFromPath ?? searchParams.get("chatId") ?? undefined
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
