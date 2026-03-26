import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const browseQuerySchema = z.object({
  q: z.string().max(200).default(''),
  node_type: z.string().max(50).default(''),
  sort: z.string().default('updated_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * GET /api/knowledge/browse
 * Returns a paginated, searchable list of knowledge graph nodes.
 *
 * Query params:
 *   q          - search term (matches label, summary, node_type)
 *   node_type  - filter by node_type (e.g. "concept", "technology")
 *   sort       - column to sort by: "label" | "updated_at" | "importance_score" | "mention_count"
 *   order      - "asc" | "desc" (default: desc)
 *   page       - 1-indexed page number (default: 1)
 *   per_page   - items per page (default: 50, max: 100)
 */
export async function GET(req: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const parsed = browseQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid query parameters', details: parsed.error.flatten() }, { status: 400 });
    }

    const q = parsed.data.q.trim();
    const nodeTypeFilter = parsed.data.node_type;
    const sortCol = parsed.data.sort;
    const order = parsed.data.order === 'asc' ? true : false; // ascending?
    const page = parsed.data.page;
    const perPage = parsed.data.per_page;

    // Validate sort column
    const allowedSorts = ['label', 'updated_at', 'importance_score', 'mention_count', 'edge_count', 'created_at'];
    const safeSort = allowedSorts.includes(sortCol) ? sortCol : 'updated_at';

    // Build query
    let query = supabase
      .from('knowledge_graph_nodes')
      .select('id, label, summary, node_type, importance_score, mention_count, edge_count, created_at, updated_at, chat_id, visibility, source_type', { count: 'exact' })
      .eq('user_id', user.id);

    // Text search: ilike on label and summary
    if (q) {
      query = query.or(`label.ilike.%${q}%,summary.ilike.%${q}%,node_type.ilike.%${q}%`);
    }

    // Node type filter
    if (nodeTypeFilter) {
      query = query.eq('node_type', nodeTypeFilter);
    }

    // Sort and paginate
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;

    query = query
      .order(safeSort, { ascending: order, nullsFirst: false })
      .range(from, to);

    const { data: nodes, count, error } = await query;

    if (error) {
      logger.error('Knowledge browse query failed', { requestId, error: error.message });
      return NextResponse.json({ error: 'Query failed' }, { status: 500 });
    }

    // Also fetch distinct node_types for filter dropdown
    const { data: typesRaw } = await supabase
      .from('knowledge_graph_nodes')
      .select('node_type')
      .eq('user_id', user.id)
      .not('node_type', 'is', null);

    const nodeTypes = [...new Set((typesRaw ?? []).map(r => r.node_type).filter(Boolean))].sort();

    logger.info('Knowledge browse', { requestId, resultCount: nodes?.length ?? 0, totalCount: count });

    return NextResponse.json({
      nodes: nodes ?? [],
      total: count ?? 0,
      page,
      perPage,
      nodeTypes,
    });

  } catch (error) {
    logger.error('Knowledge browse failed', { requestId, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
