"use client";

import { Menu, Brain, MessageSquare, Camera, BookOpen, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModelSwitcher } from "./model-switcher";
import { NotificationBell } from "@/components/agent/notification-bell";

interface TopbarProps {
  activeModel: string;
  onModelChange: (model: string) => void;
  onToggleSidebar: () => void;
  currentView: "chat" | "graph" | "snap" | "knowledge" | "research-inbox";
  onViewChange: (view: "chat" | "graph" | "snap" | "knowledge" | "research-inbox") => void;
}

export function Topbar({ 
  activeModel, 
  onModelChange, 
  onToggleSidebar,
  currentView,
  onViewChange
}: TopbarProps) {
  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onToggleSidebar}>
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle Sidebar</span>
      </Button>
      <div className="flex flex-1 items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-md">
            <Button 
              variant={currentView === "chat" ? "secondary" : "ghost"} 
              size="sm" 
              className="h-8 gap-2"
              onClick={() => onViewChange("chat")}
            >
              <MessageSquare className="h-4 w-4" />
              <span className="hidden md:inline">Chat</span>
            </Button>
            <Button
              variant={currentView === "graph" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 gap-2"
              onClick={() => onViewChange("graph")}
            >
              <Brain className="h-4 w-4 text-primary" />
              <span className="hidden md:inline font-semibold">Brain Nexus</span>
            </Button>
            <Button
              variant={currentView === "snap" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 gap-2"
              onClick={() => onViewChange("snap")}
            >
              <Camera className="h-4 w-4" />
              <span className="hidden md:inline">Snap</span>
            </Button>
            <Button
              variant={currentView === "knowledge" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 gap-2"
              onClick={() => onViewChange("knowledge")}
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden md:inline">Knowledge</span>
            </Button>
            <Button
              variant={currentView === "research-inbox" ? "secondary" : "ghost"}
              size="sm"
              className="h-8 gap-2"
              onClick={() => onViewChange("research-inbox")}
            >
              <Inbox className="h-4 w-4" />
              <span className="hidden md:inline">Research</span>
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <NotificationBell />
          <ModelSwitcher selectedModel={activeModel} onModelChange={onModelChange} />
        </div>
      </div>
    </header>
  );
}