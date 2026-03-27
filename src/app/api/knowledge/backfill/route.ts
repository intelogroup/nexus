import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processMessageKnowledge } from '@/lib/knowledge';
import { logger } from '@/lib/logger';

export async function POST(req: Request) {
  const requestId = crypto.randomUUID();
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const forceKg = url.searchParams.get('force_kg') === 'true';
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '500') || 500, 1), 500);
    const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0') || 0, 0);

    // Fetch user messages (RLS scopes to current user's chats)
    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, content, chat_id')
      .not('content', 'is', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    if (!messages || messages.length === 0) {
      return NextResponse.json({ success: true, processed: 0, total: 0 });
    }

    logger.info('Starting knowledge backfill', { requestId, count: messages.length, forceKg });

    let processedCount = 0;

    if (forceKg) {
      // Re-run KG extraction for all messages regardless of embedding status
      for (const msg of messages) {
        await processMessageKnowledge(msg.id, msg.chat_id, msg.content, user.id);
        processedCount++;
      }
    } else {
      // Normal mode: skip messages that already have embeddings
      const { data: existingEmbeddings } = await supabase
        .from('message_embeddings')
        .select('message_id')
        .in('message_id', messages.map(m => m.id));

      const existingIds = new Set(existingEmbeddings?.map(e => String(e.message_id)));

      for (const msg of messages) {
        if (!existingIds.has(String(msg.id))) {
          await processMessageKnowledge(msg.id, msg.chat_id, msg.content, user.id);
          processedCount++;
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      processed: processedCount,
      total: messages?.length 
    });
  } catch (error) {
    logger.error('Backfill failed', { requestId, error: String(error) });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
