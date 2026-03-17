import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn((model: string) => ({ model, provider: 'anthropic' })),
}))
vi.mock('ai', () => ({
  streamObject: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

import { POST } from './route'
import { createClient } from '@/lib/supabase/server'
import { streamObject } from 'ai'
import { NextRequest } from 'next/server'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/snap', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/snap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no session', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
    } as any)

    const res = await POST(makeRequest({ messages: [{ role: 'user', content: 'hello' }], chatId: 'abc' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 when messages is empty', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) },
    } as any)

    const res = await POST(makeRequest({ messages: [], chatId: 'abc' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when messages is missing', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) },
    } as any)

    const res = await POST(makeRequest({ chatId: 'abc' }))
    expect(res.status).toBe(400)
  })

  it('calls streamObject and pipes response when authenticated with valid messages', async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) },
    } as any)

    const fakeStream = {
      pipeThrough: vi.fn().mockReturnThis(),
      toTextStreamResponse: vi.fn().mockReturnValue(new Response('{}', { status: 200 })),
    }
    vi.mocked(streamObject).mockResolvedValue(fakeStream as any)

    const res = await POST(makeRequest({
      messages: [{ role: 'user', content: 'hello' }],
      chatId: 'abc',
    }))

    expect(streamObject).toHaveBeenCalledOnce()
    expect(res.status).toBe(200)
  })
})
