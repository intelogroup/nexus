import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { GET } from './route'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

const NODE = {
  id: 'n1',
  label: 'React',
  summary: 'A JS library',
  node_type: 'technology',
  importance_score: 8.5,
  mention_count: 12,
  edge_count: 5,
  created_at: '2025-01-01',
  updated_at: '2025-01-02',
  chat_id: 'c1',
  message_id: 'm1',
  visibility: 'private',
  source_type: 'extraction',
  domain_id: null,
  parent_node_id: null,
  level: 2,
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) }
}

function mockSupabaseForDetail(
  user: { id: string } | null,
  node: unknown | null,
  opts: {
    outEdges?: unknown[];
    inEdges?: unknown[];
    relatedNodes?: unknown[];
    message?: unknown | null;
    reports?: unknown[];
    nodeError?: unknown;
  } = {}
) {
  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table === 'knowledge_graph_nodes') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation((_col: string, _val: string) => ({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: node, error: opts.nodeError ?? null }),
            }),
            in: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: opts.relatedNodes ?? [] }),
            }),
          })),
        }),
      }
    }
    if (table === 'knowledge_graph_edges') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation(() => ({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: opts.outEdges ?? opts.inEdges ?? [] }),
            }),
          })),
        }),
      }
    }
    if (table === 'messages') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: opts.message ?? null }),
          }),
        }),
      }
    }
    if (table === 'research_reports') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            contains: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: opts.reports ?? [] }),
              }),
            }),
          }),
        }),
      }
    }
    return {}
  })

  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
    from: fromMock,
  } as any)
}

const req = new NextRequest('http://localhost/api/knowledge/nodes/n1')

describe('GET /api/knowledge/nodes/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    mockSupabaseForDetail(null, null)
    const res = await GET(req, makeParams('n1'))
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 404 when node not found', async () => {
    mockSupabaseForDetail({ id: 'u1' }, null)
    const res = await GET(req, makeParams('n1'))
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe('Node not found')
  })

  it('returns full node detail for authenticated user', async () => {
    mockSupabaseForDetail({ id: 'u1' }, NODE, {
      outEdges: [{ target_node_id: 'n2', relation_type: 'uses', weight: 0.8 }],
      relatedNodes: [{ id: 'n2', label: 'Next.js', node_type: 'technology' }],
      message: { id: 'm1', content: 'hello', role: 'user', created_at: '2025-01-01', chat_id: 'c1' },
      reports: [{ id: 'r1', summary: 'Report summary', confidence: 0.9, created_at: '2025-01-02', goal_id: 'g1' }],
    })
    const res = await GET(req, makeParams('n1'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.node.label).toBe('React')
    expect(body.reports).toHaveLength(1)
  })

  it('returns 500 on unexpected error', async () => {
    vi.mocked(createClient).mockRejectedValue(new Error('boom'))
    const res = await GET(req, makeParams('n1'))
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal Server Error')
  })
})
