import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export async function GET() {
  const requestId = globalThis.crypto?.randomUUID?.() ?? `req_${Date.now()}`
  try {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: chats, error } = await supabase
      .from('chats')
      .select('*')
      .eq('owner_id', user.id) // Explicit user filter for defense-in-depth
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    if (error) {
      logger.error('Failed to fetch chats', { requestId, error: error.message })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(chats)
  } catch (error) {
    logger.error('Chats GET request failed', {
      requestId,
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
