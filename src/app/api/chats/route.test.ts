import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { GET } from './route'
import { createClient } from '@/lib/supabase/server'

function mockSupabase(user: { id: string } | null, chats: unknown[] | null, error: unknown = null) {
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: async () => ({ data: { user } }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: chats, error }),
          }),
        }),
      }),
    }),
  } as any)
}

describe('GET /api/chats', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    mockSupabase(null, null)
    const res = await GET()
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns chats array for authenticated user', async () => {
    const fakeChats = [
      { id: 'c1', title: 'Chat 1', owner_id: 'u1', last_message_at: '2025-01-01', created_at: '2025-01-01' },
      { id: 'c2', title: 'Chat 2', owner_id: 'u1', last_message_at: '2025-01-02', created_at: '2025-01-02' },
    ]
    mockSupabase({ id: 'u1' }, fakeChats)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(2)
    expect(body[0].id).toBe('c1')
  })

  it('returns empty array when user has no chats', async () => {
    mockSupabase({ id: 'u1' }, [])
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual([])
  })

  it('returns 500 when DB query fails', async () => {
    mockSupabase({ id: 'u1' }, null, { message: 'Connection refused' })
    const res = await GET()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Connection refused')
  })

  it('returns 500 on unexpected error', async () => {
    vi.mocked(createClient).mockRejectedValue(new Error('crash'))
    const res = await GET()
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBe('Internal Server Error')
  })
})
