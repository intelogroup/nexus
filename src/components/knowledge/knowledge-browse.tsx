'use client';

import { useCallback, useEffect, useState } from 'react';
import { Search, ChevronUp, ChevronDown, Loader2, BookOpen, ArrowLeft, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// ─── Types ───────────────────────────────────────────────────────────
type KnowledgeNode = {
  id: string;
  label: string | null;
  summary: string | null;
  node_type: string | null;
  importance_score: number;
  mention_count: number;
  edge_count: number;
  created_at: string | null;
  updated_at: string | null;
  chat_id: string | null;
  visibility: string | null;
  source_type: string | null;
};

type BrowseResponse = {
  nodes: KnowledgeNode[];
  total: number;
  page: number;
  perPage: number;
  nodeTypes: string[];
};

type SortColumn = 'label' | 'updated_at' | 'importance_score' | 'mention_count' | 'edge_count';

// ─── Node type badge colors ──────────────────────────────────────────
const NODE_TYPE_COLORS: Record<string, string> = {
  technology:       'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  concept:          'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  person:           'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  organization:     'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  workflow:         'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  outcome:          'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  knowledge_gap:    'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  research_finding: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
};

function getNodeTypeBadgeClass(nodeType: string | null): string {
  return NODE_TYPE_COLORS[nodeType ?? ''] ?? 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── Sort header ─────────────────────────────────────────────────────
function SortHeader({
  label,
  column,
  currentSort,
  currentOrder,
  onSort,
}: {
  label: string;
  column: SortColumn;
  currentSort: SortColumn;
  currentOrder: 'asc' | 'desc';
  onSort: (col: SortColumn) => void;
}) {
  const isActive = currentSort === column;
  return (
    <button
      onClick={() => onSort(column)}
      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
    >
      {label}
      {isActive && (currentOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
    </button>
  );
}

// ─── Main component ──────────────────────────────────────────────────
export function KnowledgeBrowse() {
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [total, setTotal] = useState(0);
  const [nodeTypes, setNodeTypes] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [perPage] = useState(50);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sort, setSort] = useState<SortColumn>('importance_score');
  const [order, setOrder] = useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, typeFilter, sort, order]);

  const fetchNodes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedQuery) params.set('q', debouncedQuery);
      if (typeFilter) params.set('node_type', typeFilter);
      params.set('sort', sort);
      params.set('order', order);
      params.set('page', String(page));
      params.set('per_page', String(perPage));

      const res = await fetch(`/api/knowledge/browse?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: BrowseResponse = await res.json();
      setNodes(data.nodes);
      setTotal(data.total);
      if (data.nodeTypes.length > 0) setNodeTypes(data.nodeTypes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load knowledge');
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, typeFilter, sort, order, page, perPage]);

  useEffect(() => {
    fetchNodes();
  }, [fetchNodes]);

  const handleSort = (col: SortColumn) => {
    if (sort === col) {
      setOrder(o => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(col);
      setOrder('desc');
    }
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-primary" />
            <h1 className="text-sm font-semibold">Knowledge Base</h1>
            <span className="text-xs text-muted-foreground">
              {total} node{total !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Search and filter row */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search nodes..."
              className="w-full h-8 pl-8 pr-3 text-sm rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="h-8 text-xs rounded-md border bg-background px-2 focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">All types</option>
            {nodeTypes.map(t => (
              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[1fr_120px_80px_80px_80px_100px] gap-2 px-4 py-2 border-b bg-muted/30 text-xs">
        <SortHeader label="Label" column="label" currentSort={sort} currentOrder={order} onSort={handleSort} />
        <span className="text-xs font-medium text-muted-foreground">Type</span>
        <SortHeader label="Score" column="importance_score" currentSort={sort} currentOrder={order} onSort={handleSort} />
        <SortHeader label="Mentions" column="mention_count" currentSort={sort} currentOrder={order} onSort={handleSort} />
        <SortHeader label="Edges" column="edge_count" currentSort={sort} currentOrder={order} onSort={handleSort} />
        <SortHeader label="Updated" column="updated_at" currentSort={sort} currentOrder={order} onSort={handleSort} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && nodes.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchNodes}>Retry</Button>
          </div>
        )}

        {!loading && !error && nodes.length === 0 && (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-muted-foreground">
              {debouncedQuery || typeFilter ? 'No nodes match your search.' : 'No knowledge nodes yet.'}
            </p>
          </div>
        )}

        {nodes.map(node => (
          <div key={node.id}>
            <button
              onClick={() => setExpandedId(expandedId === node.id ? null : node.id)}
              className="w-full grid grid-cols-[1fr_120px_80px_80px_80px_100px] gap-2 px-4 py-2.5 border-b hover:bg-muted/40 transition-colors text-left"
            >
              <span className="text-sm truncate">{node.label ?? '(untitled)'}</span>
              <span>
                <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${getNodeTypeBadgeClass(node.node_type)}`}>
                  {(node.node_type ?? 'unknown').replace(/_/g, ' ')}
                </Badge>
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">{node.importance_score.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{node.mention_count}</span>
              <span className="text-xs text-muted-foreground tabular-nums">{node.edge_count}</span>
              <span className="text-xs text-muted-foreground">{formatDate(node.updated_at)}</span>
            </button>

            {/* Expanded detail row */}
            {expandedId === node.id && (
              <Card className="mx-4 my-2 p-3">
                <p className="text-xs text-muted-foreground mb-1">Summary</p>
                <p className="text-sm">{node.summary || 'No summary available.'}</p>
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  <span>Source: {node.source_type ?? 'unknown'}</span>
                  <span>Visibility: {node.visibility ?? 'private'}</span>
                  <span>Created: {formatDate(node.created_at)}</span>
                </div>
              </Card>
            )}
          </div>
        ))}
      </div>

      {/* Pagination footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t bg-background">
          <span className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ArrowLeft size={14} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <ArrowRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
