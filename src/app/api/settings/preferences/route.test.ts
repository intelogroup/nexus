import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { GET, PATCH } from './route'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/settings/preferences', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

function mockAuth(user: { id: string } | null) {
  return { auth: { getUser: async () => ({ data: { user } }) } }
}

describe('GET /api/settings/preferences', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({ ...mockAuth(null) } as any)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns default preferences when none exist', async () => {
    vi.mocked(createClient).mockResolvedValue({
      ...mockAuth({ id: 'u1' }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'Not found' },
            }),
          }),
        }),
      }),
    } as any)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.email_notifications).toBe(true)
    expect(body.push_notifications).toBe(true)
  })

  it('returns stored preferences', async () => {
    const prefs = {
      email_notifications: false,
      push_notifications: true,
      research_alerts: true,
      knowledge_gap_alerts: false,
    }
    vi.mocked(createClient).mockResolvedValue({
      ...mockAuth({ id: 'u1' }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { preferences: prefs }, error: null }),
          }),
        }),
      }),
    } as any)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.email_notifications).toBe(false)
    expect(body.knowledge_gap_alerts).toBe(false)
  })
})

describe('PATCH /api/settings/preferences', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({ ...mockAuth(null) } as any)
    const res = await PATCH(makeRequest({ email_notifications: false }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when no valid preferences provided', async () => {
    vi.mocked(createClient).mockResolvedValue({ ...mockAuth({ id: 'u1' }) } as any)
    const res = await PATCH(makeRequest({ invalid_field: true }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when non-boolean value provided', async () => {
    vi.mocked(createClient).mockResolvedValue({ ...mockAuth({ id: 'u1' }) } as any)
    const res = await PATCH(makeRequest({ email_notifications: 'yes' }))
    expect(res.status).toBe(400)
  })

  it('returns merged preferences on success', async () => {
    const fromMock = vi.fn()
    // First call: select existing prefs
    fromMock.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              preferences: {
                email_notifications: true,
                push_notifications: true,
                research_alerts: true,
                knowledge_gap_alerts: true,
              },
            },
            error: null,
          }),
        }),
      }),
    })
    // Second call: upsert
    fromMock.mockReturnValueOnce({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    })

    vi.mocked(createClient).mockResolvedValue({
      ...mockAuth({ id: 'u1' }),
      from: fromMock,
    } as any)

    const res = await PATCH(makeRequest({ email_notifications: false }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.email_notifications).toBe(false)
    expect(body.push_notifications).toBe(true)
  })
})
