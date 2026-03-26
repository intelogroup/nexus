import { streamText, createDataStreamResponse } from 'ai'
import { openai, createOpenAI } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { NextResponse, type NextRequest } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'
import { processMessageKnowledge } from '@/lib/knowledge'
import { buildKnowledgeContext } from '@/lib/retrieval'
import { getModel, DEFAULT_MODEL_ID, type Provider, type ModelDefinition } from '@/lib/models'

const PROVIDER_ENV: Record<Provider, string | undefined> = {
  openai:    process.env.OPENAI_API_KEY,
  anthropic: process.env.ANTHROPIC_API_KEY,
  google:    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  xai:       process.env.XAI_API_KEY,
}

// Backward-compat export — existing tests import this directly.
// The POST route uses getModel() directly for strict 400 behavior.
export function resolveProvider(id: string): { provider: string; apiKey: string | undefined } {
  const def = getModel(id)
  if (!def) return { provider: 'openai', apiKey: process.env.OPENAI_API_KEY }
  return { provider: def.provider, apiKey: PROVIDER_ENV[def.provider] }
}

function buildAiModel(def: ModelDefinition, apiKey: string) {
  switch (def.provider) {
    case 'openai':    return openai(def.id)
    case 'anthropic': return anthropic(def.id)
    case 'google':    return createGoogleGenerativeAI({ apiKey })(def.id)
    case 'xai':       return createOpenAI({ baseURL: 'https://api.x.ai/v1', apiKey })(def.id)
    default: {
      const _exhaustive: never = def.provider
      throw new Error(`Unhandled provider: ${def.provider}`)
    }
  }
}

export async function POST(req: NextRequest) {
  const requestId = globalThis.crypto?.randomUUID?.() ?? `req_${Date.now()}`
  logger.info('Backend Pipeline: Incoming chat request', { requestId })

  try {
    const { messages, model, chatId: incomingChatId } = await req.json()
    logger.info('Request body parsed', { requestId, model, chatId: incomingChatId, messageCount: messages?.length })

    // Validate request payload
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      logger.warn('Invalid request: messages must be a non-empty array', { requestId })
      return NextResponse.json({ error: 'Invalid request: messages must be a non-empty array' }, { status: 400 })
    }

    // Validate message size (prevent abuse)
    const totalSize = JSON.stringify(messages).length
    if (totalSize > 100000) { // 100KB limit
      logger.warn('Request too large', { requestId, totalSize })
      return NextResponse.json({ error: 'Request too large. Maximum message size is 100KB' }, { status: 413 })
    }

    const selectedModel = model || DEFAULT_MODEL_ID
    const modelDef = getModel(selectedModel)
    if (!modelDef) {
      return NextResponse.json({ error: `Unknown model: ${selectedModel}` }, { status: 400 })
    }
    const { provider } = modelDef
    const apiKey = PROVIDER_ENV[modelDef.provider]

    logger.info('Model resolved', { requestId, selectedModel, provider, hasApiKey: !!apiKey })
    logger.info('Chat request received', { requestId, model: selectedModel, provider, messageCount: messages?.length })

    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      logger.warn('Unauthorized: No user session found', { requestId })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.info('User authenticated', { requestId, userId: user.id })

    // Resolve or create a chat session
    let chatId = incomingChatId
    if (!chatId) {
      logger.info('No chatId provided, creating new chat', { requestId })
      const firstUserMessage = messages.find((m: { role: string }) => m.role === 'user')
      const title = firstUserMessage?.content?.slice(0, 80) ?? 'New Chat'
      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .insert({ title, owner_id: user.id, model: selectedModel })
        .select('id')
        .single()

      if (chatError) {
        logger.error('Failed to create chat', { requestId, error: chatError.message })
        throw new Error(`Chat creation failed: ${chatError.message}`)
      }

      chatId = chat?.id
      logger.info('New chat created', { requestId, chatId })

      // Add owner to chat_members
      if (chatId) {
        const { error: memberError } = await supabase
          .from('chat_members')
          .insert({ chat_id: chatId, user_id: user.id, role: 'owner' })

        if (memberError) {
          logger.error('Failed to add chat member', { requestId, error: memberError.message })
        }
      }
    } else {
      // Verify user has access to existing chat
      logger.info('Verifying user access to chat', { requestId, chatId })
      const { data: chatMember, error: memberCheckError } = await supabase
        .from('chat_members')
        .select('*')
        .eq('chat_id', chatId)
        .eq('user_id', user.id)
        .single()

      if (memberCheckError || !chatMember) {
        logger.error('Forbidden chat access attempt', { requestId, userId: user.id, chatId })
        return NextResponse.json({ error: 'Forbidden: You do not have access to this chat' }, { status: 403 })
      }
      logger.info('User access verified', { requestId, chatId })
    }

    // Save the latest user message
    const lastUserMessage = [...messages].reverse().find((m: { role: string }) => m.role === 'user')
    if (chatId && lastUserMessage) {
      logger.info('Saving user message', { requestId })
      const { data: msg, error: msgError } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          sender_role: 'user',
          content: lastUserMessage.content,
          model_used: selectedModel,
          provider,
        })
        .select('id')
        .single()

      if (msgError) {
        logger.error('Failed to save user message', { requestId, error: msgError.message })
      } else {
        logger.info('User message saved', { requestId, msgId: msg?.id })
      }
    }

    if (!apiKey) {
      logger.error('Missing API key', { requestId, provider, model: selectedModel })
      return NextResponse.json(
        { error: `Missing API key for provider: ${provider}`, requestId },
        { status: 500 }
      )
    }

    // ── Hybrid knowledge retrieval ──────────────────────────────────────────
    // Failure is non-fatal — chat should work even if knowledge retrieval fails.
    let knowledgeContext: string | null = null
    try {
      knowledgeContext = await buildKnowledgeContext(
        supabase,
        user.id,
        lastUserMessage?.content ?? '',
        chatId
      )
    } catch (knowledgeError) {
      logger.error('Knowledge context retrieval failed, continuing without it', {
        requestId,
        error: knowledgeError instanceof Error ? knowledgeError.message : String(knowledgeError),
      })
    }

    // Inject knowledge context as the first system message if available.
    // This gives the model awareness of what the user already knows across
    // all their chats and their knowledge graph — without repeating it in
    // every message.
    const augmentedMessages = knowledgeContext
      ? [
          {
            role: 'system' as const,
            content: [
              'You have access to the following personal knowledge context for this user.',
              'Use it to give more informed, personalized responses.',
              'Do not mention that you have this context unless directly relevant.',
              '',
              knowledgeContext,
            ].join('\n'),
          },
          ...messages,
        ]
      : messages

    logger.info('Starting streamText', { requestId, selectedModel, hasKnowledgeContext: !!knowledgeContext })
    const aiModel = buildAiModel(modelDef, apiKey)

    return createDataStreamResponse({
      execute: (dataStream) => {
        try {
          dataStream.writeMessageAnnotation({
            model_used: selectedModel,
          })

          const result = streamText({
            model: aiModel,
            messages: augmentedMessages,
            temperature: 1,
            onError: (event) => {
              logger.error('streamText error', { requestId, error: event.error })
            },
            async onFinish({ text, usage }) {
              logger.info('Stream finished', { requestId, usage })
              if (chatId) {
                waitUntil((async () => {
                  const startedAt = Date.now()
                  const { data: msg, error } = await supabase.from('messages').insert({
                    chat_id: chatId,
                    sender_role: 'assistant',
                    content: text,
                    model_used: selectedModel,
                    provider,
                  }).select('id').single()

                  if (error) {
                    logger.error('Failed to save assistant message', { requestId, error: error.message })
                  } else if (msg) {
                    logger.info('Assistant message saved', { requestId, msgId: msg.id })

                    // ── KG extraction throttle ──────────────────────────────
                    // Run extraction on a window of messages rather than every
                    // message. Triggers when:
                    //   • 50+ messages since last extraction, OR
                    //   • 6h have elapsed since last extraction AND ≥10 messages
                    const KG_WINDOW_SIZE = 50
                    const KG_TIME_HOURS  = 6
                    const KG_TIME_MIN    = 10

                    const { data: chat } = await supabase
                      .from('chats')
                      .select('last_kg_extraction_at')
                      .eq('id', chatId)
                      .single()

                    const since = chat?.last_kg_extraction_at ?? null
                    const sinceQuery = supabase
                      .from('messages')
                      .select('id, content, sender_role', { count: 'exact' })
                      .eq('chat_id', chatId)
                      .order('created_at', { ascending: true })

                    if (since) sinceQuery.gt('created_at', since)

                    const { data: windowMsgs, count: windowCount } = await sinceQuery

                    const elapsed = since
                      ? (Date.now() - new Date(since).getTime()) / 3600000
                      : Infinity

                    const hitSizeThreshold = (windowCount ?? 0) >= KG_WINDOW_SIZE
                    const hitTimeThreshold = elapsed >= KG_TIME_HOURS && (windowCount ?? 0) >= KG_TIME_MIN

                    if ((hitSizeThreshold || hitTimeThreshold) && windowMsgs && windowMsgs.length > 0) {
                      logger.info('KG extraction threshold reached', { requestId, windowCount, elapsed: elapsed.toFixed(1), trigger: hitSizeThreshold ? 'size' : 'time' })

                      // Process each message in the window sequentially (non-blocking overall)
                      for (const m of windowMsgs) {
                        await processMessageKnowledge(m.id, chatId, m.content, user.id).catch(e => {
                          logger.error('Background KG processing failed', { requestId, msgId: m.id, error: e.message })
                        })
                      }

                      // Stamp the extraction time so the next window starts fresh
                      await supabase
                        .from('chats')
                        .update({ last_kg_extraction_at: new Date().toISOString() })
                        .eq('id', chatId)
                    }
                  }

                  // Record generation stats
                  await supabase.from('llm_generations').insert({
                    chat_id: chatId,
                    message_id: msg?.id ?? null,
                    model: selectedModel,
                    provider,
                    input_tokens: usage?.promptTokens ?? null,
                    output_tokens: usage?.completionTokens ?? null,
                    latency_ms: Date.now() - startedAt,
                  })
                })())
              }
            },
          })

          result.mergeIntoDataStream(dataStream)
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          logger.error('Error inside data stream execute', { requestId, error: errorMessage })
          throw error
        }
      },
      onError: (error) => {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorStack = error instanceof Error ? error.stack : undefined
        const errorName = error instanceof Error ? error.name : 'Unknown'
        logger.error('Data stream error', { requestId, errorName, errorMessage, errorStack })
        return 'An error occurred while generating the response. Please try again.'
      },
      headers: chatId ? { 'x-chat-id': chatId } : undefined,
    })
  } catch (error) {
    logger.error('Chat request failed', {
      requestId,
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: 'Internal Server Error', requestId },
      { status: 500 }
    )
  }
}
