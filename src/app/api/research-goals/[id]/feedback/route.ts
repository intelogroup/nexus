import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const FeedbackSchema = z.object({
  feedback: z.union([z.literal(1), z.literal(0), z.literal(-1)]),
  topic_node_id: z.string().uuid().optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = globalThis.crypto?.randomUUID?.() ?? `req_${Date.now()}`
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: goalId } = await params

    const body = await req.json().catch(() => null)
    const parsed = FeedbackSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }
    const { feedback, topic_node_id } = parsed.data

    // Write feedback to goal (RLS ensures user owns it)
    const { error: goalErr } = await supabase
      .from('research_goals')
      .update({ feedback })
      .eq('id', goalId)
      .eq('user_id', user.id)

    if (goalErr) {
      logger.error('Failed to write goal feedback', { requestId, error: goalErr.message })
      return NextResponse.json({ error: goalErr.message }, { status: 500 })
    }

    // Update agent_feedback_stats so future scans bias toward liked topics
    if (topic_node_id) {
      const incrementCol =
        feedback === 1 ? 'positive_feedback' :
        feedback === -1 ? 'negative_feedback' :
        'neutral_feedback'

      // Upsert via raw SQL increment (Supabase JS doesn't support column += 1 directly)
      const { error: statsErr } = await supabase.rpc('increment_feedback_stat', {
        p_user_id: user.id,
        p_topic_node_id: topic_node_id,
        p_column: incrementCol,
      })

      if (statsErr) {
        // Non-fatal — feedback on goal was already written
        logger.error('Failed to update feedback stats', { requestId, error: statsErr.message })
      }
    }

    logger.info('Feedback recorded', { requestId, goalId, feedback })
    return NextResponse.json({ ok: true })
  } catch (err) {
    logger.error('Feedback POST failed', {
      requestId,
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
