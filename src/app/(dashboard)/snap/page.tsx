import { createClient } from '@/lib/supabase/server'
import { SnapCanvas } from '@/components/snap/snap-canvas'

export default async function SnapPage({
  searchParams,
}: {
  searchParams: Promise<{ chatId?: string }>
}) {
  const { chatId } = await searchParams

  if (!chatId) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">No chat selected. Go to a chat first, then click Snap to visualize it.</p>
        <a href="/" className="text-sm text-primary underline hover:text-primary/80">Back to chats</a>
      </div>
    )
  }

  const supabase = await createClient()

  const { data: messages } = await supabase
    .from('messages')
    .select('sender_role, content')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true })
    .limit(50)

  const initialMessages = (messages ?? []).map(m => ({
    role: m.sender_role as 'user' | 'assistant',
    content: m.content,
  }))

  if (initialMessages.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Start a conversation first, then Snap it.</p>
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      <SnapCanvas messages={initialMessages} chatId={chatId} />
    </div>
  )
}
