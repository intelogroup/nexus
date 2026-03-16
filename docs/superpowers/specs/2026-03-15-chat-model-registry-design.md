# Chat Model Registry Design

**Date:** 2026-03-15
**Status:** Approved
**Scope:** `omnichat` — model list, route handler, model switcher UI

---

## Problem

Model IDs are defined in three separate places that drift out of sync:

1. `src/components/chat/model-switcher.tsx` — UI list
2. `resolveProvider()` in `src/app/api/chat/route.ts` — provider lookup switch
3. The `aiModel` instantiation switch in the same route

When a new model is added to the UI but not the backend (e.g. `claude-3-opus-latest`, `claude-3-7-sonnet-20250219`), the provider is misresolved or the API rejects the ID, producing:
```
Error (anthropic/claude-3-opus-latest): model: claude-3-opus-latest
```

A secondary bug: `temperature: 1` is passed to OpenAI reasoning models (`o3`, `o4-mini`) which do not accept the parameter, causing API errors.

The WebSocket errors in the console (`/_next/webpack-hmr failed`) are unrelated — they are Next.js HMR reconnection noise from dev server restarts.

---

## Solution: Single Model Registry

One file — `src/lib/models.ts` — is the authoritative source of truth. Both the UI and the route import from it. Adding a model = one line in one file.

---

## Architecture

### `src/lib/models.ts` (new file)

```ts
export type Provider = 'openai' | 'anthropic' | 'google' | 'xai'

export type ModelDefinition = {
  id: string
  label: string
  provider: Provider
  supportsTemperature: boolean
  maxTokens?: number
}

export const MODELS: ModelDefinition[] = [
  // Claude 4 family
  { id: 'claude-opus-4-6',            label: 'Claude Opus 4.6',        provider: 'anthropic', supportsTemperature: true },
  { id: 'claude-sonnet-4-6',          label: 'Claude Sonnet 4.6 🔥',   provider: 'anthropic', supportsTemperature: true },
  { id: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku 4.5',       provider: 'anthropic', supportsTemperature: true },
  // Claude 3.7
  { id: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet',      provider: 'anthropic', supportsTemperature: true },
  // OpenAI GPT-4.1 family
  { id: 'gpt-4.1',                    label: 'GPT-4.1',                 provider: 'openai',    supportsTemperature: true },
  { id: 'gpt-4.1-mini',               label: 'GPT-4.1 mini',           provider: 'openai',    supportsTemperature: true },
  // OpenAI reasoning
  { id: 'o3',                         label: 'o3 (Reasoning)',          provider: 'openai',    supportsTemperature: false },
  { id: 'o4-mini',                    label: 'o4-mini (Reasoning)',     provider: 'openai',    supportsTemperature: false },
  // Google
  { id: 'gemini-3.1-pro-preview',     label: 'Gemini 3.1 Pro',         provider: 'google',    supportsTemperature: true },
  // xAI
  { id: 'grok-4',                     label: 'Grok 4',                  provider: 'xai',       supportsTemperature: true },
]

export const DEFAULT_MODEL = 'claude-sonnet-4-6'

export function getModel(id: string): ModelDefinition {
  return MODELS.find(m => m.id === id) ?? MODELS.find(m => m.id === DEFAULT_MODEL)!
}
```

### `src/app/api/chat/route.ts` (modified)

- Remove `resolveProvider()` switch statement — replaced by `getModel(selectedModel).provider`
- Remove the `aiModel` instantiation switch — replaced by a `buildAiModel(def)` helper that maps provider → SDK factory call
- `temperature` is conditionally passed only when `def.supportsTemperature === true`
- `maxTokens` is read from `def.maxTokens` if present
- Default model changes from `gpt-4o` to `DEFAULT_MODEL`
- `resolveProvider` export is kept as a thin wrapper for backward compat with tests

### `src/components/chat/model-switcher.tsx` (modified)

- Remove the local `models` array
- Import `MODELS` from `@/lib/models`
- Map over `MODELS` to render `CommandItem` entries — no other changes needed

---

## Data Flow

```
User selects model in ModelSwitcher
       ↓ (model.id string)
ChatArea sends POST /api/chat { model: id }
       ↓
route.ts: getModel(id) → ModelDefinition
       ↓
buildAiModel(def) → SDK instance
streamText({ model, temperature: def.supportsTemperature ? 1 : undefined, ... })
       ↓ SSE stream
useChat hook on client receives tokens
```

---

## Error Handling

- `getModel()` falls back to `DEFAULT_MODEL` if an unknown ID is passed — prevents silent defaulting to gpt-4o
- Provider API errors are surfaced via the existing `onError` handler with format `Error (provider/modelId): message`
- No changes to the SSE streaming transport (already correct)

---

## What Is NOT Changed

- Streaming transport (`createDataStreamResponse` + SSE) — already correct, not WebSockets
- Supabase auth, chat creation, message persistence logic
- Knowledge graph processing
- Any UI outside `model-switcher.tsx`

---

## Files Touched

| File | Change |
|---|---|
| `src/lib/models.ts` | **Create** — model registry |
| `src/app/api/chat/route.ts` | **Edit** — use registry, fix temperature/maxTokens per model |
| `src/components/chat/model-switcher.tsx` | **Edit** — import MODELS from registry |

---

## Testing

- Manually send a message with each provider to verify no API errors
- Verify `o3` and `o4-mini` calls do not include `temperature` in the request
- Verify that selecting an unknown model ID falls back to `claude-sonnet-4-6` rather than silently using `gpt-4o`
