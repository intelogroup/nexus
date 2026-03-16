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

When a new model is added to the UI but not the backend, the provider is misresolved or the API rejects the ID. Secondary bugs: `temperature: 1` is passed to o3/o4-mini which reject it; unknown model IDs silently fall back to `gpt-4o`.

The WebSocket errors in the console (`/_next/webpack-hmr failed`) are Next.js HMR reconnection noise — unrelated to chat.

---

## Solution: Single Model Registry

One file — `src/lib/models.ts` — is the single source of truth. Both UI and backend import from it.

---

## Architecture

### `src/lib/models.ts` (new file)

```ts
export type Provider = 'openai' | 'anthropic' | 'google' | 'xai'

export interface ModelDefinition {
  readonly id: string
  readonly label: string
  readonly provider: Provider
  readonly supportsTemperature: boolean
}

export const MODELS: readonly ModelDefinition[] = [
  // Claude 4 family — IDs per Anthropic API (system prompt context, 2026-03)
  { id: 'claude-opus-4-6',            label: 'Claude Opus 4.6',       provider: 'anthropic', supportsTemperature: true },
  { id: 'claude-sonnet-4-6',          label: 'Claude Sonnet 4.6 🔥',  provider: 'anthropic', supportsTemperature: true },
  { id: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku 4.5',      provider: 'anthropic', supportsTemperature: true },
  // Claude 3.7
  { id: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet',     provider: 'anthropic', supportsTemperature: true },
  // OpenAI GPT-4.1
  { id: 'gpt-4.1',                    label: 'GPT-4.1',                provider: 'openai',    supportsTemperature: true },
  { id: 'gpt-4.1-mini',               label: 'GPT-4.1 mini',          provider: 'openai',    supportsTemperature: true },
  // OpenAI reasoning models — do NOT accept temperature parameter
  { id: 'o3',                         label: 'o3 (Reasoning)',         provider: 'openai',    supportsTemperature: false },
  { id: 'o4-mini',                    label: 'o4-mini (Reasoning)',    provider: 'openai',    supportsTemperature: false },
  // Google — verified via ai.google.dev/gemini-api/docs/models/gemini-3.1-pro-preview (2026-03)
  { id: 'gemini-3.1-pro-preview',     label: 'Gemini 3.1 Pro',        provider: 'google',    supportsTemperature: true },
  // xAI — verified via docs.x.ai/developers/models/grok-4 (2026-03)
  { id: 'grok-4',                     label: 'Grok 4',                 provider: 'xai',       supportsTemperature: true },
] as const

export const DEFAULT_MODEL_ID = 'claude-sonnet-4-6'

// Startup assertion: will throw at module load time if DEFAULT_MODEL_ID is not in MODELS
const _defaultCheck = MODELS.find(m => m.id === DEFAULT_MODEL_ID)
if (!_defaultCheck) throw new Error(`DEFAULT_MODEL_ID "${DEFAULT_MODEL_ID}" not found in MODELS`)

/**
 * Returns the ModelDefinition for the given ID, or null if not found.
 * Callers are responsible for handling the null case (e.g. returning 400).
 */
export function getModel(id: string): ModelDefinition | null {
  return MODELS.find(m => m.id === id) ?? null
}
```

---

### `src/app/api/chat/route.ts` (modified)

**Remove:** `resolveProvider()` switch, `aiModel` instantiation switch.

**Add:**

```ts
import { getModel, DEFAULT_MODEL_ID } from '@/lib/models'

// Provider env key map
const PROVIDER_ENV: Record<string, string | undefined> = {
  openai:    process.env.OPENAI_API_KEY,
  anthropic: process.env.ANTHROPIC_API_KEY,
  google:    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  xai:       process.env.XAI_API_KEY,
}

function buildAiModel(id: string) {
  const def = getModel(id)!  // caller has already validated
  switch (def.provider) {
    case 'openai':    return openai(def.id)
    case 'anthropic': return anthropic(def.id)
    case 'google':    return google(def.id)
    case 'xai':       return xai(def.id)
    default: {
      const _: never = def.provider
      throw new Error(`Unhandled provider: ${def.provider}`)
    }
  }
}
```

**Unknown model ID → 400 (not silent fallback):**

```ts
const selectedModel = model || DEFAULT_MODEL_ID
const def = getModel(selectedModel)
if (!def) {
  return NextResponse.json({ error: `Unknown model: ${selectedModel}` }, { status: 400 })
}
```

**streamText call:**

```ts
const result = streamText({
  model: buildAiModel(selectedModel),
  messages,
  ...(def.supportsTemperature ? { temperature: 1 } : {}),
  ...
})
```

**`resolveProvider` export** — kept as thin wrapper for existing test compat:

```ts
// Backward compat — tests that import resolveProvider directly
export function resolveProvider(id: string): { provider: string; apiKey: string | undefined } {
  const def = getModel(id)
  if (!def) return { provider: 'openai', apiKey: process.env.OPENAI_API_KEY }
  return { provider: def.provider, apiKey: PROVIDER_ENV[def.provider] }
}
```

**Default model** changes from `'gpt-4o'` to `DEFAULT_MODEL_ID`.

---

### `src/components/chat/model-switcher.tsx` (modified)

- Remove local `models` array and its implicit type
- Add `import { MODELS } from '@/lib/models'`
- Replace `models.map(...)` with `MODELS.map(...)` — `ModelDefinition` has same `id`/`label` shape, no prop type changes needed elsewhere

---

## Data Flow

```
User selects model in ModelSwitcher (renders from MODELS)
       ↓ model.id string
POST /api/chat { model: id, messages, chatId }
       ↓
getModel(id) → null → 400 Bad Request
               def  → buildAiModel(def) → SDK instance
                       streamText({ model, temperature?: 1 }) → SSE
                       useChat receives tokens → renders stream
                       onFinish → save messages + llm_generations
```

---

## Files Touched

| File | Change |
|---|---|
| `src/lib/models.ts` | **Create** |
| `src/app/api/chat/route.ts` | **Edit** |
| `src/components/chat/model-switcher.tsx` | **Edit** |

No other files need changes. `ModelDefinition` has the same `id`/`label` fields as the old local type, so no prop type updates are required in parent components.

---

## Testing

**Unit tests — `src/lib/models.test.ts` (new):**
- `getModel('claude-sonnet-4-6')` returns correct definition
- `getModel('unknown-id')` returns `null`
- Every entry with `provider: 'openai'` and reasoning capability has `supportsTemperature: false`
- `MODELS` contains no duplicate `id` values
- `DEFAULT_MODEL_ID` resolves to a valid entry (also enforced at module load by startup assertion)

**Unit tests — `src/app/api/chat/route.test.ts` (existing, extend):**
- POST with unknown model returns 400
- POST with `o3` does not include `temperature` in the streamText call (spy/mock)
- `resolveProvider` still returns correct provider for known IDs (backward compat)

**Manual smoke tests:**
- Send a message with each of the 4 providers — no API errors
- Confirm `o3`/`o4-mini` server logs show no `temperature` field
