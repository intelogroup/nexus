import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = globalThis.crypto?.randomUUID?.() ?? `req_${Date.now()}`
  const { id: chatId } = await params
  
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // RLS will handle permission check, but we can also check ownership explicitly if desired
    const { error } = await supabase
      .from('chats')
      .delete()
      .eq('id', chatId)
      .eq('owner_id', user.id)

    if (error) {
      logger.error('Failed to delete chat', { requestId, chatId, error: error.message })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Chat DELETE request failed', {
      requestId,
      chatId,
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
