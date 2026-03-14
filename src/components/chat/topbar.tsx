"use client";

import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModelSwitcher } from "./model-switcher";

interface TopbarProps {
  activeModel: string;
  onModelChange: (model: string) => void;
  onToggleSidebar: () => void;
}

export function Topbar({ activeModel, onModelChange, onToggleSidebar }: TopbarProps) {
  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onToggleSidebar}>
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle Sidebar</span>
      </Button>
      <div className="flex flex-1 items-center justify-between">
        <div className="font-semibold text-lg hidden sm:block">OmniChat</div>
        <div className="flex items-center gap-4 ml-auto">
          <ModelSwitcher activeModel={activeModel} onModelChange={onModelChange} />
        </div>
      </div>
    </header>
  );
}