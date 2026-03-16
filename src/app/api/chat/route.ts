import { streamText, createDataStreamResponse } from 'ai'
import { openai, createOpenAI } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import { NextResponse, type NextRequest } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'
import { processMessageKnowledge } from '@/lib/knowledge'
import { getModel, DEFAULT_MODEL_ID, type Provider, type ModelDefinition } from '@/lib/models'

// xAI (Grok) is OpenAI compatible
const xai = createOpenAI({
  baseURL: 'https://api.x.ai/v1',
  apiKey: process.env.XAI_API_KEY,
})

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

function buildAiModel(def: ModelDefinition) {
  switch (def.provider) {
    case 'openai':    return openai(def.id)
    case 'anthropic': return anthropic(def.id)
    case 'google':    return google(def.id)
    case 'xai':       return xai(def.id)
    default: {
      const _exhaustive: never = def.provider
      throw new Error(`Unhandled provider: ${def.provider}`)
    }
  }
}

export async function POST(req: NextRequest) {
  const requestId = globalThis.crypto?.randomUUID?.() ?? `req_${Date.now()}`
  console.log(`[${requestId}] >>> Backend Pipeline: Incoming chat request`)

  try {
    const { messages, model, chatId: incomingChatId } = await req.json()
    console.log(`[${requestId}] Request Body:`, { model, chatId: incomingChatId, messageCount: messages?.length })

    // Validate request payload
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      console.warn(`[${requestId}] Invalid request: messages must be a non-empty array`)
      return NextResponse.json({ error: 'Invalid request: messages must be a non-empty array' }, { status: 400 })
    }

    // Validate message size (prevent abuse)
    const totalSize = JSON.stringify(messages).length
    if (totalSize > 100000) { // 100KB limit
      console.warn(`[${requestId}] Request too large: ${totalSize} bytes`)
      return NextResponse.json({ error: 'Request too large. Maximum message size is 100KB' }, { status: 413 })
    }

    const selectedModel = model || DEFAULT_MODEL_ID
    const modelDef = getModel(selectedModel)
    if (!modelDef) {
      return NextResponse.json({ error: `Unknown model: ${selectedModel}` }, { status: 400 })
    }
    const { provider } = modelDef
    const apiKey = PROVIDER_ENV[modelDef.provider]

    console.log(`[${requestId}] Selected Model: ${selectedModel}`)
    console.log(`[${requestId}] Resolved Provider: ${provider}, hasApiKey: ${!!apiKey}`)

    logger.info('Chat request received', { requestId, model: selectedModel, provider, messageCount: messages?.length })

    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.warn(`[${requestId}] Unauthorized: No user session found`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.log(`[${requestId}] Authenticated User: ${user.id}`)

    // Resolve or create a chat session
    let chatId = incomingChatId
    if (!chatId) {
      console.log(`[${requestId}] No chatId provided, creating new chat...`)
      const firstUserMessage = messages.find((m: { role: string }) => m.role === 'user')
      const title = firstUserMessage?.content?.slice(0, 80) ?? 'New Chat'
      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .insert({ title, owner_id: user.id, model: selectedModel })
        .select('id')
        .single()

      if (chatError) {
        console.error(`[${requestId}] Chat creation failed:`, chatError.message)
        logger.error('Failed to create chat', { requestId, error: chatError.message })
        throw new Error(`Chat creation failed: ${chatError.message}`)
      }

      chatId = chat?.id
      console.log(`[${requestId}] New chat created with ID: ${chatId}`)

      // Add owner to chat_members
      if (chatId) {
        const { error: memberError } = await supabase
          .from('chat_members')
          .insert({ chat_id: chatId, user_id: user.id, role: 'owner' })

        if (memberError) {
          console.error(`[${requestId}] Failed to add chat member:`, memberError.message)
          logger.error('Failed to add chat member', { requestId, error: memberError.message })
        }
      }
    } else {
      // Verify user has access to existing chat
      console.log(`[${requestId}] Verifying user access to existing chat: ${chatId}`)
      const { data: chatMember, error: memberCheckError } = await supabase
        .from('chat_members')
        .select('*')
        .eq('chat_id', chatId)
        .eq('user_id', user.id)
        .single()

      if (memberCheckError || !chatMember) {
        console.warn(`[${requestId}] Forbidden: User ${user.id} does not have access to chat ${chatId}`)
        logger.error('Forbidden chat access attempt', { requestId, userId: user.id, chatId })
        return NextResponse.json({ error: 'Forbidden: You do not have access to this chat' }, { status: 403 })
      }
      console.log(`[${requestId}] User access verified for chat: ${chatId}`)
    }

    // Save the latest user message
    const lastUserMessage = [...messages].reverse().find((m: { role: string }) => m.role === 'user')
    if (chatId && lastUserMessage) {
      console.log(`[${requestId}] Saving user message to database...`)
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
        console.error(`[${requestId}] Failed to save user message:`, msgError.message)
        logger.error('Failed to save user message', { requestId, error: msgError.message })
      } else if (msg) {
        console.log(`[${requestId}] User message saved with ID: ${msg.id}. Triggering KG processing...`)
        // Process knowledge graph for user message (non-blocking)
        waitUntil(
          processMessageKnowledge(msg.id, chatId, lastUserMessage.content, user.id).catch(e => {
            console.error(`[${requestId}] Background KG processing failed (user):`, e.message)
            logger.error('Background KG processing failed (user)', { requestId, error: e.message })
          })
        )
      }
    }

    if (!apiKey) {
      console.error(`[${requestId}] API Key Missing for provider: ${provider}`)
      logger.error('Missing API key', { requestId, provider, model: selectedModel })
      return NextResponse.json(
        { error: `Missing API key for provider: ${provider}`, requestId },
        { status: 500 }
      )
    }

    console.log(`[${requestId}] Instantiating AI model: ${selectedModel} from ${provider}`)
    const aiModel = buildAiModel(modelDef)

    console.log(`[${requestId}] Starting streamText...`)
    return createDataStreamResponse({
      execute: (dataStream) => {
        try {
          console.log(`[${requestId}] Writing message annotation: { model_used: ${selectedModel} }`)
          dataStream.writeMessageAnnotation({
            model_used: selectedModel,
          })

          const result = streamText({
            model: aiModel,
            messages,
            ...(modelDef.supportsTemperature ? { temperature: 1 } : {}),
            onError: (event) => {
              console.error(`[${requestId}] streamText error:`, event.error)
              logger.error('streamText error', { requestId, error: event.error })
            },
            async onFinish({ text, usage }) {
              console.log(`[${requestId}] Stream finished. Usage:`, usage)
              logger.info('Stream finished', { requestId, usage })
              if (chatId) {
                console.log(`[${requestId}] Saving assistant response to database...`)
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
                    console.error(`[${requestId}] Failed to save assistant message:`, error.message)
                    logger.error('Failed to save assistant message', { requestId, error: error.message })
                  } else if (msg) {
                    console.log(`[${requestId}] Assistant message saved with ID: ${msg.id}. Triggering KG processing...`)
                    // Process knowledge graph for assistant message
                    await processMessageKnowledge(msg.id, chatId, text, user.id).catch(e => {
                      console.error(`[${requestId}] Background KG processing failed (assistant):`, e.message)
                      logger.error('Background KG processing failed (assistant)', { requestId, error: e.message })
                    })
                  }

                  // Record generation stats
                  console.log(`[${requestId}] Recording generation stats...`)
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
          console.error(`[${requestId}] Error inside data stream execute:`, error)
          logger.error('Error inside data stream execute', { requestId, error: errorMessage })
          // Errors in execute are handled by the framework automatically
          throw error
        }
      },
      onError: (error) => {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorStack = error instanceof Error ? error.stack : undefined
        const errorName = error instanceof Error ? error.name : 'Unknown'
        console.error(`[${requestId}] Data stream error:`, { name: errorName, message: errorMessage, stack: errorStack, rawError: error })
        logger.error('Data stream error', { requestId, errorName, errorMessage, errorStack })
        // Return the actual error message to help with debugging
        // Include provider info to help diagnose provider-specific issues
        return `Error (${provider}/${selectedModel}): ${errorMessage}`
      },
      headers: chatId ? { 'x-chat-id': chatId } : undefined,
    })
  } catch (error) {
    console.error(`[${requestId}] CRITICAL PIPELINE ERROR:`, error instanceof Error ? error.message : String(error))
    logger.error('Chat request failed', {
      requestId,
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        requestId,
      },
      { status: 500 }
    )
  }
}
