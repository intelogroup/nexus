import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatArea } from "@/components/chat/chat-area";
import { DEFAULT_MODEL_ID } from "@/lib/models";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: chatId } = await params;
  const supabase = await createClient();

  // Parallelize metadata and message fetching to avoid sequential waterfalls
  const [chatResult, messagesResult] = await Promise.all([
    supabase
      .from("chats")
      .select("*")
      .eq("id", chatId)
      .single(),
    supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(50)
  ]);

  const { data: chat } = chatResult;
  const { data: messages } = messagesResult;

  if (!chat) {
    return notFound();
  }

  // Reverse messages to chronological order
  const initialMessages = (messages || []).reverse().map(msg => ({
    id: msg.id.toString(),
    role: msg.sender_role,
    content: msg.content,
    createdAt: msg.created_at,
    model_used: msg.model_used ?? undefined,
  }));

  return (
    <ChatArea 
      activeModel={chat.model || DEFAULT_MODEL_ID}
      chatId={chatId} 
      initialMessages={initialMessages}
    />
  );
}
