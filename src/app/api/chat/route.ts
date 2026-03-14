import { streamText } from 'ai'
import { openai } from '@ai-sdk/openai'
import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { NextResponse } from 'next/server'

// xAI (Grok) is OpenAI compatible, so we create a custom OpenAI instance
const xai = createOpenAI({
  baseURL: 'https://api.x.ai/v1',
  apiKey: process.env.XAI_API_KEY,
})

export async function POST(req: Request) {
  try {
    const { messages, model } = await req.json()
    
    // Default to GPT-4o if no model is selected
    const selectedModel = model || 'gpt-4o'
    
    let aiModel;
    
    // Map the selected model string to the actual AI SDK model instance
    switch (selectedModel) {
      case 'gpt-4o':
        aiModel = openai('gpt-4o');
        break;
      case 'claude-3-5-sonnet-20240620':
        aiModel = anthropic('claude-3-5-sonnet-20240620');
        break;
      case 'models/gemini-1.5-pro':
        aiModel = google('models/gemini-1.5-pro');
        break;
      case 'grok-2':
        aiModel = xai('grok-2-latest');
        break;
      default:
        aiModel = openai('gpt-4o');
    }

    const result = await streamText({
      model: aiModel,
      messages,
      // You can add logic here to save the assistant's response to Supabase
      // using the `onFinish` callback.
      /*
      async onFinish({ text, usage }) {
        // ...save to database
      }
      */
    })

    return result.toTextStreamResponse()
  } catch (error) {
    console.error('API Chat Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}