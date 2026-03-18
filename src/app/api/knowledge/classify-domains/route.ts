// src/app/api/knowledge/classify-domains/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { classifyToOntology } from '@/lib/ontology';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit  = parseInt(searchParams.get('limit')  ?? '20');
  const offset = parseInt(searchParams.get('offset') ?? '0');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Fetch nodes that haven't been classified yet
  const { data: nodes, error } = await supabase
    .from('knowledge_graph_nodes')
    .select('id, label, summary, user_id')
    .eq('user_id', user.id)
    .is('domain_id', null)
    .neq('node_type', 'subdomain')
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!nodes || nodes.length === 0) {
    return NextResponse.json({ classified: 0, done: true });
  }

  let classified = 0;
  for (const node of nodes) {
    try {
      const result = await classifyToOntology(
        node.label ?? '',
        node.summary ?? '',
        node.user_id
      );
      if (result) {
        await supabase
          .from('knowledge_graph_nodes')
          .update({
            domain_id: result.domainId,
            parent_node_id: result.subdomainNodeId,
          })
          .eq('id', node.id);
        classified++;
      }
    } catch (err) {
      logger.warn('Backfill classification failed for node', { nodeId: node.id });
    }
  }

  const remaining = nodes.length === limit; // if we got a full page, there may be more
  return NextResponse.json({ classified, offset, done: !remaining });
}
