import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export async function GET(
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

    // Verify access to chat
    const { data: member, error: memberError } = await supabase
      .from('chat_members')
      .select('role')
      .eq('chat_id', chatId)
      .eq('user_id', user.id)
      .single()

    if (memberError || !member) {
      logger.warn('Unauthorized access attempt to chat messages', { requestId, chatId, userId: user.id })
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Optimize query to use the DESC index and limit to 50
    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(50)

    if (error) {
      logger.error('Failed to fetch messages', { requestId, chatId, error: error.message })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Map DB messages to UI messages (role mapping) and reverse for chronological order
    const uiMessages = messages.reverse().map(msg => ({
      id: msg.id.toString(),
      role: msg.sender_role,
      content: msg.content,
      createdAt: msg.created_at,
      model_used: msg.model_used,
    }))

    // Add Cache-Control to speed up back-and-forth navigation
    return NextResponse.json(uiMessages, {
      headers: {
        'Cache-Control': 'private, max-age=10, stale-while-revalidate=59',
      },
    })
  } catch (error) {
    logger.error('Messages GET request failed', {
      requestId,
      chatId,
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
