import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { GET, POST, DELETE } from './route'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

function makeRequest(method: string, body?: unknown) {
  return new NextRequest('http://localhost/api/settings/api-keys', {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'Content-Type': 'application/json' } : {},
  })
}

function mockAuth(user: { id: string } | null) {
  return { auth: { getUser: async () => ({ data: { user } }) } }
}

describe('GET /api/settings/api-keys', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({
      ...mockAuth(null),
    } as any)
    const res = await GET()
    expect(res.status).toBe(401)
  })

  it('returns API keys for authenticated user', async () => {
    const keys = [{ id: 'k1', label: 'Prod', masked_key: 'sk-1…abcd', created_at: '2025-01-01' }]
    vi.mocked(createClient).mockResolvedValue({
      ...mockAuth({ id: 'u1' }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: keys, error: null }),
          }),
        }),
      }),
    } as any)
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(1)
    expect(body[0].label).toBe('Prod')
  })

  it('returns 500 on DB error', async () => {
    vi.mocked(createClient).mockResolvedValue({
      ...mockAuth({ id: 'u1' }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB fail' } }),
          }),
        }),
      }),
    } as any)
    const res = await GET()
    expect(res.status).toBe(500)
  })
})

describe('POST /api/settings/api-keys', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({ ...mockAuth(null) } as any)
    const res = await POST(makeRequest('POST', { label: 'test', key: 'sk-12345678' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when label is missing', async () => {
    vi.mocked(createClient).mockResolvedValue({ ...mockAuth({ id: 'u1' }) } as any)
    const res = await POST(makeRequest('POST', { key: 'sk-12345678' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when key is too short', async () => {
    vi.mocked(createClient).mockResolvedValue({ ...mockAuth({ id: 'u1' }) } as any)
    const res = await POST(makeRequest('POST', { label: 'test', key: 'short' }))
    expect(res.status).toBe(400)
  })

  it('returns 201 on success', async () => {
    const insertedKey = { id: 'k2', label: 'Dev', masked_key: 'sk-1…5678', created_at: '2025-01-02' }
    vi.mocked(createClient).mockResolvedValue({
      ...mockAuth({ id: 'u1' }),
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: insertedKey, error: null }),
          }),
        }),
      }),
    } as any)
    const res = await POST(makeRequest('POST', { label: 'Dev', key: 'sk-12345678' }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.label).toBe('Dev')
  })
})

describe('DELETE /api/settings/api-keys', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when not authenticated', async () => {
    vi.mocked(createClient).mockResolvedValue({ ...mockAuth(null) } as any)
    const res = await DELETE(makeRequest('DELETE', { id: 'k1' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when id is missing', async () => {
    vi.mocked(createClient).mockResolvedValue({ ...mockAuth({ id: 'u1' }) } as any)
    const res = await DELETE(makeRequest('DELETE', {}))
    expect(res.status).toBe(400)
  })

  it('returns 200 on success', async () => {
    vi.mocked(createClient).mockResolvedValue({
      ...mockAuth({ id: 'u1' }),
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      }),
    } as any)
    const res = await DELETE(makeRequest('DELETE', { id: 'k1' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
  })
})
