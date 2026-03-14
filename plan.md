# OmniChat: Multi-Model PWA Architecture Plan

## 1. High-Level Overview
OmniChat is a Progressive Web App (PWA) designed for seamless cross-device usage (Phone, Laptop) allowing users to chat with top-tier LLMs (GPT-4o, Claude 3.5 Sonnet, Gemini 1.5 Pro, Grok 2) in a single unified interface. It uses a server-side proxy to protect API keys and a cloud database (Supabase) to sync conversation history across devices instantly.

## 2. Tech Stack
*   **Framework:** Next.js (App Router) - Handles both React frontend and secure server-side API routes.
*   **AI Integration:** Vercel AI SDK - Industry standard for streaming chat interfaces with built-in provider adapters.
*   **Database & Auth:** Supabase (PostgreSQL) - Handles user authentication and instant cloud syncing of chat history.
*   **Styling & UI:** Tailwind CSS + shadcn/ui.
*   **PWA Enabler:** `next-pwa` or equivalent service worker integration.
*   **Token Estimation:** `gpt-tokenizer` for fast, client-side context window calculations.

## 3. Core Features
*   **Mid-Conversation Model Switching:** Users can change the active AI model at any point in a chat thread. The UI will reflect which model generated each specific message via badges/icons.
*   **Dynamic Context Window Visualizer:** A dynamic progress bar that calculates the estimated token count of the current conversation history and displays it relative to the selected model's maximum context limit (e.g., 128k for GPT-4o, 2M for Gemini 1.5 Pro).
*   **Cross-Device Cloud Sync:** Powered by Supabase, allowing users to start a chat on their phone and continue on their laptop.

## 4. Database Schema (Supabase)

### `chats` Table
Represents a single conversation thread.
*   `id` (UUID, Primary Key)
*   `user_id` (UUID, Foreign Key to `auth.users`)
*   `title` (String, e.g., "Brainstorming Startup Ideas")
*   `created_at` (Timestamp, default `now()`)

### `messages` Table
Represents individual messages within a chat thread.
*   `id` (UUID, Primary Key)
*   `chat_id` (UUID, Foreign Key linking to `chats.id`, with cascade delete)
*   `role` (String: 'user', 'assistant', or 'system')
*   `content` (Text: The markdown message content)
*   `model_used` (String, nullable) - Tracks which model generated the response (e.g., 'gpt-4o'). Null for user messages.
*   `estimated_tokens` (Int) - Caches the token size of the message for quick context bar calculation without recounting history.
*   `created_at` (Timestamp, default `now()`)

## 5. Implementation Roadmap

### Phase 1: Foundation & Scaffold (Completed)
- [x] Initialize Next.js App Router project.
- [x] Install Tailwind CSS and shadcn/ui.
- [x] Install Vercel AI SDK and provider packages (@ai-sdk/openai, @ai-sdk/anthropic, etc.).
- [x] Install Supabase SSR client libraries.

### Phase 2: Core Utilities & API Routes (In Progress)
- [x] Setup Supabase Client/Server utility files (`src/lib/supabase`).
- [x] Setup Token Estimator utility (`src/lib/tokens.ts`).
- [x] Create the unified AI proxy route (`src/app/api/chat/route.ts`).

### Phase 3: Supabase Configuration (Pending User Action)
- [ ] Create Supabase Project.
- [ ] Execute SQL schema for `chats` and `messages`.
- [ ] Setup Row Level Security (RLS) policies.
- [ ] Add `.env.local` with Supabase credentials and AI API keys.

### Phase 4: Frontend Development (Next Steps)
- [ ] **Layout:** Create the responsive shell (Sidebar for history, Topbar for model selection).
- [ ] **Chat UI:** Implement message bubbles, markdown rendering (`react-markdown`), and the Vercel AI `useChat` hook.
- [ ] **Context Visualizer:** Build the progress bar component that reads `useChat` messages, estimates tokens, and compares against `MODEL_LIMITS`.
- [ ] **Model Switcher:** Create the dropdown to update the active model state.

### Phase 5: Polish & PWA
- [ ] Connect `useChat`'s `onFinish` callback in the backend to save messages to Supabase.
- [ ] Implement fetching logic to load past `chats` into the sidebar.
- [ ] Configure `manifest.json` and service worker for PWA installability.