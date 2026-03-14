"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, PlusCircle } from "lucide-react";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

// Temporary mock chats
const mockChats = [
  { id: "1", title: "React Component Ideas" },
  { id: "2", title: "PostgreSQL Indexing Tips" },
  { id: "3", title: "Supabase RLS Rules" },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const SidebarContent = () => (
    <div className="flex h-full flex-col gap-4">
      <div className="px-4 py-2">
        <Button className="w-full justify-start" variant="outline">
          <PlusCircle className="mr-2 h-4 w-4" />
          New Chat
        </Button>
      </div>
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-1 p-2">
          {mockChats.map((chat) => (
            <Button
              key={chat.id}
              variant="ghost"
              className="w-full justify-start font-normal"
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              <span className="truncate">{chat.title}</span>
            </Button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r bg-muted/40 h-full">
        <div className="flex h-14 items-center border-b px-4 lg:px-6 font-semibold">
          OmniChat History
        </div>
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar via Sheet */}
      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="p-4 border-b text-left">
            <SheetTitle>OmniChat History</SheetTitle>
          </SheetHeader>
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </>
  );
}