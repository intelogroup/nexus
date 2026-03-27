import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * GET /api/research-reports
 * Returns a paginated list of completed research reports for the current user.
 *
 * Query params:
 *   page      - 1-indexed page (default: 1)
 *   per_page  - items per page (default: 20, max: 50)
 *   status    - filter by status (default: 'completed')
 */
export async function GET(req: NextRequest) {
  const requestId = globalThis.crypto?.randomUUID?.() ?? `req_${Date.now()}`
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const searchParams = req.nextUrl.searchParams
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get('per_page') || '20', 10)))
    const status = searchParams.get('status') || 'completed'

    const from = (page - 1) * perPage
    const to = from + perPage - 1

    // Fetch reports with count
    let query = supabase
      .from('research_reports')
      .select('id, goal_id, summary, key_claims, confidence, model_used, created_at, linked_node_ids, research_goals!goal_id(title)', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (status !== 'all') {
      query = query.eq('status', status)
    }

    const { data: reports, error, count } = await query

    if (error) {
      logger.error('Research reports list failed', { requestId, error: error.message })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const enriched = (reports ?? []).map(({ research_goals, ...r }) => ({
      ...r,
      goal_title: (research_goals as unknown as { title: string } | null)?.title ?? 'Untitled research',
    }))

    logger.info('Research reports listed', { requestId, count, page })
    return NextResponse.json({
      reports: enriched,
      total: count ?? 0,
      page,
      perPage,
    })
  } catch (err) {
    logger.error('Research reports list GET failed', {
      requestId,
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
