import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { z } from 'zod'

const ApproveSchema = z.object({
  when: z.enum(['now', 'in_5h', 'tonight']),
  instructions: z.string().max(2000).optional(),
  timezone: z.string().max(100).optional(),
})

function resolveRunAt(when: 'now' | 'in_5h' | 'tonight', timezone?: string): Date | null {
  if (when === 'now') return null
  if (when === 'in_5h') return new Date(Date.now() + 5 * 60 * 60 * 1000)

  // tonight = next 22:00 in the user's timezone (default UTC)
  const tz = timezone ?? 'UTC'
  try {
    // Determine the current date/hour in the user's timezone via Intl
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', hour12: false,
    })
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date()).map(({ type, value }) => [type, value])
    )
    const year = parseInt(parts.year, 10)
    const month = parseInt(parts.month, 10) - 1 // 0-indexed
    const day = parseInt(parts.day, 10)
    const hour = parseInt(parts.hour, 10)

    // Build 22:00 today in the user's tz. If already >= 22, push to tomorrow.
    // We compute the UTC offset for the tz by comparing a known instant.
    const refUtc = new Date(Date.UTC(year, month, day, 22, 0, 0))
    // Format that UTC instant in the target tz to find the offset
    const localStr = refUtc.toLocaleString('sv-SE', { timeZone: tz })
    const localRef = new Date(localStr + 'Z')
    const offsetMs = localRef.getTime() - refUtc.getTime()
    // Target: 22:00 in tz = 22:00 - offset in UTC
    let tonight = new Date(Date.UTC(year, month, day, 22, 0, 0) - offsetMs)
    if (hour >= 22) {
      tonight = new Date(tonight.getTime() + 24 * 60 * 60 * 1000)
    }
    return tonight
  } catch {
    // Invalid timezone: fall back to UTC 22:00
    const tonight = new Date()
    tonight.setUTCHours(22, 0, 0, 0)
    if (tonight <= new Date()) tonight.setDate(tonight.getDate() + 1)
    return tonight
  }
}

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

    // Validate body
    const body = await req.json().catch(() => null)
    const parsed = ApproveSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }
    const { when, instructions, timezone } = parsed.data

    // Fetch goal — RLS ensures it belongs to this user
    const { data: goal, error: fetchErr } = await supabase
      .from('research_goals')
      .select('id, status, user_id')
      .eq('id', goalId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (fetchErr || !goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 })
    }
    if (goal.status !== 'proposed') {
      return NextResponse.json({ error: `Goal is already ${goal.status}` }, { status: 409 })
    }

    // Check pending guardrail
    const { count: pendingCount } = await supabase
      .from('research_goals')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .in('status', ['approved', 'running'])

    const { data: settings } = await supabase
      .from('user_agent_settings')
      .select('max_approved_pending')
      .eq('user_id', user.id)
      .maybeSingle()

    const maxPending = settings?.max_approved_pending ?? 3
    if ((pendingCount ?? 0) >= maxPending) {
      return NextResponse.json(
        { error: `You already have ${pendingCount} active research tasks. Wait for one to complete.` },
        { status: 429 }
      )
    }

    const runAt = resolveRunAt(when, timezone)

    const updates: Record<string, unknown> = {
      status: runAt ? 'approved' : 'running',
      run_at: runAt?.toISOString() ?? null,
    }
    if (instructions) updates.instructions = instructions

    // Atomically update only if still in 'proposed' status to prevent race conditions
    const { data: updated, error: updateErr } = await supabase
      .from('research_goals')
      .update(updates)
      .eq('id', goalId)
      .eq('status', 'proposed')
      .select('id, status, run_at, title')
      .maybeSingle()

    if (updateErr) {
      logger.error('Failed to approve goal', { requestId, error: updateErr.message })
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    if (!updated) {
      return NextResponse.json({ error: 'Goal has already been approved or is no longer proposed' }, { status: 409 })
    }

    logger.info('Research goal approved', { requestId, goalId, when, runAt })

    // Fire immediately for "now" — don't await, let the Edge Function run async
    if (when === 'now') {
      const fnUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/execute-research`
        : null

      if (fnUrl) {
        fetch(fnUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Service role key authorizes the Edge Function call server-side only
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`,
          },
          body: JSON.stringify({ goal_id: goalId }),
        }).catch(() => {
          // Non-critical: cron will retry within 15 min if this fails
        })
      }
    }

    return NextResponse.json(updated)
  } catch (err) {
    logger.error('Approve goal failed', {
      requestId,
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
