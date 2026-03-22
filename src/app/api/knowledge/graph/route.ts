import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

type DomainRow = { id: number; name: string; slug: string; color: string | null; icon: string | null };
type NodeCountRow = { domain_id: number | null };
type SubdomainRow = { id: string; label: string | null; summary: string | null; domain_id: number | null };
type ConceptRow = {
  id: string;
  label: string | null;
  summary: string | null;
  node_type: string | null;
  chat_id: string | null;
  message_id: string | null;
  domain_id: number | null;
};

export async function GET(req: NextRequest) {
  const requestId = `kg_fetch_${Date.now()}`;
  const { searchParams } = new URL(req.url);
  const domainIdParam    = searchParams.get('domain_id');
  const subdomainIdParam = searchParams.get('subdomain_id');

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;

    // ── Level 0: return domains + subdomain counts (initial load) ──────────────
    if (!domainIdParam && !subdomainIdParam) {
      const { data: domainsRaw } = await db.from('domains').select('id, name, slug, color, icon').order('id');
      const domains = domainsRaw as DomainRow[] | null;

      // Count user's nodes per domain for sizing
      const { data: countsRaw } = await db
        .from('knowledge_graph_nodes')
        .select('domain_id')
        .eq('user_id', user.id)
        .not('domain_id', 'is', null);
      const counts = countsRaw as NodeCountRow[] | null;

      const countMap: Record<number, number> = {};
      (counts ?? []).forEach(n => {
        if (n.domain_id) countMap[n.domain_id] = (countMap[n.domain_id] ?? 0) + 1;
      });

      const cyNodes = (domains ?? [])
        .filter(d => (countMap[d.id] ?? 0) > 0)  // only domains with content
        .map(d => ({
          data: {
            id: `domain_${d.id}`,
            label: d.name,
            nodeType: 'domain',
            level: 0,
            slug: d.slug,
            color: d.color,
            icon: d.icon,
            count: countMap[d.id] ?? 0,
          }
        }));

      logger.info('KG domain overview', { requestId, domainCount: cyNodes.length });
      return NextResponse.json({ elements: cyNodes, level: 0 });
    }

    // ── Level 1: return subdomain nodes for a domain ───────────────────────────
    if (domainIdParam && !subdomainIdParam) {
      const domainId = parseInt(domainIdParam);
      if (Number.isNaN(domainId)) {
        return NextResponse.json({ error: 'Invalid domain_id' }, { status: 400 });
      }

      const { data: subdomainsRaw } = await db
        .from('knowledge_graph_nodes')
        .select('id, label, summary, domain_id')
        .eq('user_id', user.id)
        .eq('domain_id', domainId)
        .eq('node_type', 'subdomain')
        .eq('level', 1)
        .order('label');
      const subdomains = subdomainsRaw as SubdomainRow[] | null;

      const cyNodes = (subdomains ?? []).map(n => ({
        data: {
          id: n.id,
          label: n.label,
          nodeType: 'subdomain',
          level: 1,
          domainId: n.domain_id,
          fullText: n.summary ?? '',
        }
      }));

      return NextResponse.json({ elements: cyNodes, level: 1, domainId });
    }

    // ── Level 2: return concept nodes under a subdomain ───────────────────────
    if (subdomainIdParam) {
      // Validate UUID format to prevent malformed queries
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(subdomainIdParam)) {
        return NextResponse.json({ error: 'Invalid subdomain_id' }, { status: 400 });
      }

      const { data: nodesRaw } = await db
        .from('knowledge_graph_nodes')
        .select('id, label, summary, node_type, chat_id, message_id, domain_id')
        .eq('user_id', user.id)
        .eq('parent_node_id', subdomainIdParam)
        .eq('level', 2)
        .order('label')
        .limit(200);
      const nodes = nodesRaw as ConceptRow[] | null;

      const nodeIds = (nodes ?? []).map(n => n.id);

      // Fetch edges between these concept nodes
      const { data: edges } = nodeIds.length > 0
        ? await supabase
            .from('knowledge_graph_edges')
            .select('source_node_id, target_node_id, relation_type, weight')
            .eq('user_id', user.id)
            .in('source_node_id', nodeIds)
            .in('target_node_id', nodeIds)
        : { data: [] };

      const cyNodes = (nodes ?? []).map(n => ({
        data: {
          id: n.id,
          label: n.label,
          nodeType: n.node_type,
          level: 2,
          domainId: n.domain_id,
          fullText: n.summary ?? '',
          chatId: n.chat_id,
          messageId: n.message_id,
        }
      }));

      const cyEdges = (edges ?? []).map((e, i) => ({
        data: {
          id: `e${i}`,
          source: e.source_node_id,
          target: e.target_node_id,
          label: e.relation_type,
          weight: e.weight,
        }
      }));

      return NextResponse.json({
        elements: [...cyNodes, ...cyEdges],
        level: 2,
        subdomainId: subdomainIdParam
      });
    }

    return NextResponse.json({ elements: [], level: 0 });

  } catch (error) {
    logger.error('KG fetch failed', { requestId, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
