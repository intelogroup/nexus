"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, PlusCircle, LogOut, Trash2, MoreVertical, Brain } from "lucide-react";
import { logout } from "@/app/login/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  selectedChatId?: string | null;
  onChatSelect?: (chatId: string | null) => void;
  onChatDeleted?: (chatId: string) => void;
  initialChats?: { id: string; title: string; created_at: string }[];
}

export function Sidebar({ isOpen, onClose, onChatDeleted, initialChats = [] }: SidebarProps) {
  const [chats, setChats] = useState<{ id: string; title: string; created_at: string }[]>(initialChats);
  const [isLoading, setIsLoading] = useState(false);
  const pathname = usePathname();
  const isInitialRender = useRef(true);

  const fetchChats = async () => {
    // Only fetch if we are not already loading and we don't have enough data
    // Or if this is a manual refresh (which we don't have yet but good to keep in mind)
    setIsLoading(true);
    try {
      const response = await fetch("/api/chats");
      if (response.ok) {
        const data = await response.json();
        setChats(data);
      }
    } catch {
      // Fetch failure — sidebar will show empty state; user can retry by reopening
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Always fetch fresh chats when sidebar opens to pick up newly created chats
    if (isOpen) {
      fetchChats();
    }
  }, [isOpen]);

  useEffect(() => {
    // Update local state if initialChats change from server (e.g. on navigation)
    // But don't overwrite if we've already loaded something more recent
    if (initialChats.length > 0) {
      setChats(initialChats);
    }
  }, [initialChats]);

  const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this chat?")) return;

    try {
      const res = await fetch(`/api/chats/${chatId}`, { method: "DELETE" });
      if (res.ok) {
        setChats((prev) => prev.filter((c) => c.id !== chatId));
        if (onChatDeleted) onChatDeleted(chatId);
      }
    } catch {
      // Delete failure — chat remains in list, no user-facing side effect
    }
  };

  const SidebarContent = () => (
    <div className="flex h-full flex-col gap-4">
      <div className="px-4 py-4">
        <Link href="/">
          <Button 
            className="w-full justify-start rounded-xl h-11 bg-primary hover:bg-primary/90 shadow-sm transition-all" 
            onClick={() => onClose()}
          >
            <PlusCircle className="mr-2 h-4 w-4" />
            <span className="font-semibold tracking-tight">New Chat</span>
          </Button>
        </Link>
      </div>
      <ScrollArea className="flex-1 px-3">
        <div className="space-y-1">
          {isLoading && chats.length === 0 ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 w-full bg-muted/50 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : chats.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center opacity-30 italic">
              <MessageSquare size={32} className="mb-2" />
              <p className="text-[10px] uppercase tracking-widest">No Records Found</p>
            </div>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                data-testid="sidebar-chat-item"
                className={`group flex items-center gap-1 rounded-lg px-2 py-1 transition-colors ${
                  pathname === `/chats/${chat.id}` ? "bg-secondary" : "hover:bg-muted/50"
                }`}
              >
                <Link
                  href={`/chats/${chat.id}`}
                  className="flex-1 flex items-center font-normal h-9 px-2 overflow-hidden hover:no-underline"
                  onClick={() => onClose()}
                >
                  <MessageSquare className={`mr-2 h-4 w-4 shrink-0 ${pathname === `/chats/${chat.id}` ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="truncate text-sm">{chat.title}</span>
                </Link>
                
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={(props) => (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        {...props}
                      >
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    )}
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem 
                      className="text-destructive focus:text-destructive"
                      onClick={(e) => handleDeleteChat(e as any, chat.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
      <div className="mt-auto border-t bg-muted/20 p-4">
        <form action={logout}>
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-transparent px-2" type="submit">
            <LogOut className="mr-2 h-4 w-4" />
            <span className="text-sm font-medium">Terminate Session</span>
          </Button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:flex w-72 flex-col border-r bg-muted/30 h-full">
        <div className="flex h-16 items-center border-b px-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
              <Brain size={20} />
            </div>
            <span className="font-bold text-xl tracking-tight">Nexus</span>
          </div>
        </div>
        <SidebarContent />
      </aside>

      <Sheet open={isOpen} onOpenChange={onClose}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="p-6 border-b text-left">
            <SheetTitle className="font-bold tracking-tighter uppercase italic text-sm">Nexus Archive</SheetTitle>
          </SheetHeader>
          <SidebarContent />
        </SheetContent>
      </Sheet>
    </>
  );
}
