import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SnapGraph } from './route'

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn((model: string) => ({ model, provider: 'anthropic' })),
}))
vi.mock('ai', () => ({
  streamObject: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
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

describe('SnapGraph type', () => {
  it('accepts a node with description', () => {
    const graph: SnapGraph = {
      type: 'summary',
      title: 'Test',
      nodes: [{ id: 'n1', label: 'Node', category: 'root', description: 'A root node.' }],
      edges: [],
    }
    expect(graph.nodes[0].description).toBe('A root node.')
  })

  it('accepts a node without description (optional)', () => {
    const graph: SnapGraph = {
      type: 'summary',
      title: 'Test',
      nodes: [{ id: 'n1', label: 'Node', category: 'root' }],
      edges: [],
    }
    expect(graph.nodes[0].description).toBeUndefined()
  })
})

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
