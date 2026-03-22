import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { GET } from './route'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

function makeRequest(queryParams: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/research-inbox')
  for (const [k, v] of Object.entries(queryParams)) url.searchParams.set(k, v)
  return new NextRequest(url.toString())
}

function mockSupabase(user: { id: string } | null, data: unknown[] | null, error: unknown = null, count = 0) {
  const rangeChain = vi.fn().mockResolvedValue({ data, error, count })
  const orderChain = vi.fn().mockReturnValue({ range: rangeChain })
  const inChain = vi.fn().mockReturnValue({ order: orderChain })
  const eqChain = vi.fn().mockReturnValue({ in: inChain })
  const selectChain = vi.fn().mockReturnValue({ eq: eqChain })
  const fromChain = vi.fn().mockReturnValue({ select: selectChain })

  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user } }) },
    from: fromChain,
  } as any)
}

describe('GET /api/research-inbox', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    mockSupabase(null, null)
    const res = await GET(makeRequest())
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns goals array and total for authenticated user', async () => {
    const goals = [
      { id: 'g1', title: 'Goal 1', status: 'pending', created_at: '2025-01-01' },
      { id: 'g2', title: 'Goal 2', status: 'pending', created_at: '2025-01-02' },
    ]
    mockSupabase({ id: 'u1' }, goals, null, 2)
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.goals).toHaveLength(2)
    expect(body.total).toBe(2)
  })

  it('returns empty array when no goals', async () => {
    mockSupabase({ id: 'u1' }, [], null, 0)
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.goals).toEqual([])
    expect(body.total).toBe(0)
  })

  it('defaults to pending status when no status param provided', async () => {
    const inMock = vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({
        range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
      }),
    })
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ in: inMock }),
        }),
      }),
    } as any)

    await GET(makeRequest())
    expect(inMock).toHaveBeenCalledWith('status', ['pending'])
  })

  it('clamps limit to max 100', async () => {
    const rangeMock = vi.fn().mockResolvedValue({ data: [], error: null, count: 0 })
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({ range: rangeMock }),
            }),
          }),
        }),
      }),
    } as any)

    await GET(makeRequest({ limit: '9999' }))
    // range should be called with offset 0, limit-1 = 99 (clamped to 100)
    expect(rangeMock).toHaveBeenCalledWith(0, 99)
  })

  it('supports multiple statuses via comma-separated param', async () => {
    const inMock = vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({
        range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
      }),
    })
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ in: inMock }),
        }),
      }),
    } as any)

    await GET(makeRequest({ status: 'pending,approved' }))
    expect(inMock).toHaveBeenCalledWith('status', ['pending', 'approved'])
  })

  it('returns 500 on DB error', async () => {
    mockSupabase({ id: 'u1' }, null, { message: 'DB error' })
    const res = await GET(makeRequest())
    expect(res.status).toBe(500)
  })
})
