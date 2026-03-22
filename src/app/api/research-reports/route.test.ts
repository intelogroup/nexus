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

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/research-reports')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return new NextRequest(url)
}

function mockSupabase(
  user: { id: string } | null,
  reports: unknown[] | null,
  opts: { count?: number; error?: unknown; goals?: unknown[] } = {}
) {
  const fromMock = vi.fn().mockImplementation((table: string) => {
    if (table === 'research_reports') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation(() => ({
            order: vi.fn().mockReturnValue({
              range: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: reports, error: opts.error ?? null, count: opts.count ?? (reports?.length ?? 0) }),
              }),
            }),
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                range: vi.fn().mockResolvedValue({ data: reports, error: opts.error ?? null, count: opts.count ?? (reports?.length ?? 0) }),
              }),
            }),
          })),
        }),
      }
    }
    if (table === 'research_goals') {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: opts.goals ?? [] }),
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

describe('GET /api/research-reports', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    mockSupabase(null, null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns paginated reports for authenticated user', async () => {
    const reports = [
      { id: 'r1', goal_id: 'g1', summary: 'Summary 1', key_claims: [], confidence: 0.9, model_used: 'gpt-4', created_at: '2025-01-01', linked_node_ids: [] },
    ]
    mockSupabase({ id: 'u1' }, reports, { count: 1, goals: [{ id: 'g1', title: 'Goal One' }] })
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.reports).toHaveLength(1)
    expect(body.reports[0].goal_title).toBe('Goal One')
    expect(body.total).toBe(1)
  })

  it('returns 500 on unexpected error', async () => {
    vi.mocked(createClient).mockRejectedValue(new Error('boom'))
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal Server Error')
  })
})
