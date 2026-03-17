import { streamObject } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { z } from 'zod'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SnapGraphSchema = z.object({
  type: z.enum(['brainstorm', 'summary', 'technical']),
  title: z.string(),
  nodes: z.array(z.object({
    id: z.string(),
    label: z.string(),
    category: z.enum(['root', 'agreed', 'open', 'next', 'topic', 'point']),
  })),
  edges: z.array(z.object({
    source: z.string(),
    target: z.string(),
  })),
})

export type SnapGraph = z.infer<typeof SnapGraphSchema>

const SYSTEM_PROMPT = `You analyze a conversation and produce a structured diagram.

Determine the conversation type:
- "brainstorm": contains design decisions, feature specs, explicit agreements/disagreements, or open questions
- "summary": general Q&A, factual, or exploratory conversation
- "technical": code architecture or system design (treat as summary for now)

For "brainstorm":
1. One "root" node with the central topic
2. Three "agreed"/"open"/"next" bucket nodes as children of root
3. Leaf "point" nodes under each bucket for specific items

For "summary"/"technical":
1. One "root" node
2. "topic" nodes as children of root
3. "point" nodes as children of topics

Rules:
- Labels must be ≤ 6 words
- Maximum 20 nodes total
- Every edge must reference valid node IDs
- Node IDs must be unique strings (e.g. "n1", "n2")`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { messages?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { messages } = body
  // chatId is received for client-side tracking only; route is ephemeral — no DB reads/writes.

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: 'Invalid request: messages must be a non-empty array' }, { status: 400 })
  }

  // Guard against excessively large payloads
  const totalSize = JSON.stringify(messages).length
  if (totalSize > 100000) {
    return NextResponse.json({ error: 'Request too large. Maximum message size is 100KB' }, { status: 413 })
  }

  try {
    const conversationText = (messages as { role: string; content: string }[])
      .map(m => `${m.role}: ${m.content}`)
      .join('\n')

    const result = await streamObject({
      model: anthropic('claude-sonnet-4-6'),
      schema: SnapGraphSchema,
      prompt: `${SYSTEM_PROMPT}\n\nConversation:\n${conversationText}`,
    })

    return result.toTextStreamResponse()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: `Stream error: ${message}` }, { status: 500 })
  }
}
