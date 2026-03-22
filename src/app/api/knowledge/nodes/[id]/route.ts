import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'

/**
 * GET /api/knowledge/nodes/:id
 * Returns full detail for a single knowledge node including:
 *   - node metadata
 *   - related nodes (via edges)
 *   - source messages
 *   - linked research reports
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const requestId = globalThis.crypto?.randomUUID?.() ?? `req_${Date.now()}`
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id: nodeId } = await params

    // 1. Fetch the node itself
    const { data: node, error: nodeError } = await supabase
      .from('knowledge_graph_nodes')
      .select('id, label, summary, node_type, importance_score, mention_count, edge_count, created_at, updated_at, chat_id, message_id, visibility, source_type, domain_id, parent_node_id, level')
      .eq('id', nodeId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (nodeError || !node) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 })
    }

    // 2. Fetch related nodes via edges (both directions)
    const { data: outEdges } = await supabase
      .from('knowledge_graph_edges')
      .select('target_node_id, relation_type, weight')
      .eq('user_id', user.id)
      .eq('source_node_id', nodeId)
      .limit(50)

    const { data: inEdges } = await supabase
      .from('knowledge_graph_edges')
      .select('source_node_id, relation_type, weight')
      .eq('user_id', user.id)
      .eq('target_node_id', nodeId)
      .limit(50)

    // Collect unique related node IDs
    const relatedIdSet = new Set<string>()
    const edgeMap: Array<{ nodeId: string; relation: string; weight: number; direction: 'out' | 'in' }> = []

    for (const e of outEdges ?? []) {
      relatedIdSet.add(e.target_node_id)
      edgeMap.push({ nodeId: e.target_node_id, relation: e.relation_type, weight: e.weight, direction: 'out' })
    }
    for (const e of inEdges ?? []) {
      relatedIdSet.add(e.source_node_id)
      edgeMap.push({ nodeId: e.source_node_id, relation: e.relation_type, weight: e.weight, direction: 'in' })
    }

    const relatedIds = Array.from(relatedIdSet)
    let relatedNodes: Array<{ id: string; label: string; node_type: string }> = []
    if (relatedIds.length > 0) {
      const { data: rn } = await supabase
        .from('knowledge_graph_nodes')
        .select('id, label, node_type')
        .eq('user_id', user.id)
        .in('id', relatedIds)
        .limit(50)
      relatedNodes = (rn ?? []) as typeof relatedNodes
    }

    // Build related list with relation info
    const related = relatedNodes.map(rn => {
      const edge = edgeMap.find(e => e.nodeId === rn.id)
      return {
        id: rn.id,
        label: rn.label,
        node_type: rn.node_type,
        relation: edge?.relation ?? 'related',
        weight: edge?.weight ?? 0,
        direction: edge?.direction ?? 'out',
      }
    })

    // 3. Fetch source message (if message_id is present)
    let sourceMessage: { id: string; content: string; role: string; created_at: string; chat_id: string } | null = null
    if (node.message_id) {
      const { data: msg } = await supabase
        .from('messages')
        .select('id, content, role, created_at, chat_id')
        .eq('id', node.message_id)
        .maybeSingle()
      sourceMessage = msg as typeof sourceMessage
    }

    // 4. Fetch research reports that link to this node
    const { data: reports } = await supabase
      .from('research_reports')
      .select('id, summary, confidence, created_at, goal_id')
      .eq('user_id', user.id)
      .contains('linked_node_ids', [nodeId])
      .order('created_at', { ascending: false })
      .limit(10)

    logger.info('Knowledge node detail fetched', { requestId, nodeId })

    return NextResponse.json({
      node,
      related,
      sourceMessage,
      reports: reports ?? [],
    })
  } catch (err) {
    logger.error('Knowledge node detail GET failed', {
      requestId,
      error: err instanceof Error ? err.message : String(err),
    })
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
