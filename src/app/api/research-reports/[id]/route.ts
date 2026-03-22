import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = globalThis.crypto?.randomUUID?.() ?? `req_${Date.now()}`
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: reportId } = await params

    // Fetch report — RLS ensures it belongs to this user
    const { data: report, error } = await supabase
      .from('research_reports')
      .select('*')
      .eq('id', reportId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (error || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // Fetch linked node labels so the UI can show concept names
    let linkedNodes: Array<{ id: string; label: string; node_type: string }> = []
    if (Array.isArray(report.linked_node_ids) && report.linked_node_ids.length > 0) {
      const { data: nodes } = await supabase
        .from('knowledge_graph_nodes')
        .select('id, label, node_type')
        .eq('user_id', user.id)
        .in('id', report.linked_node_ids)
        .limit(30)

      linkedNodes = (nodes ?? []) as typeof linkedNodes
    }

    logger.info('Research report fetched', { requestId, reportId })
    return NextResponse.json({ ...report, linked_nodes: linkedNodes })
  } catch (err) {
    logger.error('Research report GET failed', {
      requestId,
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
