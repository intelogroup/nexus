# Chat Model Registry Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace three scattered model ID lists with a single registry file so adding a new model requires one line in one place.

**Architecture:** Create `src/lib/models.ts` as the single source of truth; update `route.ts` to use `getModel()` + `buildAiModel()` instead of switch statements; update `model-switcher.tsx` to render from the registry. Unknown model IDs return HTTP 400 instead of silently routing to the wrong model.

**Tech Stack:** Next.js 16, Vercel AI SDK (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`), Vitest, TypeScript 5

**Spec:** `docs/superpowers/specs/2026-03-15-chat-model-registry-design.md`

---

## Chunk 1: Model Registry File

### Task 1: Create `src/lib/models.ts` with tests

**Files:**
- Create: `src/lib/models.ts`
- Create: `src/lib/models.test.ts`

- [ ] **Step 1.1 — Write the failing tests first**

Create `src/lib/models.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { MODELS, DEFAULT_MODEL_ID, getModel } from './models'

describe('MODELS registry', () => {
  it('has no duplicate IDs', () => {
    const ids = MODELS.map(m => m.id)
    const unique = new Set(ids)
    expect(ids.length).toBe(unique.size)
  })

  it('every entry has non-empty id, label, and valid provider', () => {
    const validProviders = ['openai', 'anthropic', 'google', 'xai']
    for (const m of MODELS) {
      expect(m.id.length).toBeGreaterThan(0)
      expect(m.label.length).toBeGreaterThan(0)
      expect(validProviders).toContain(m.provider)
    }
  })

  it('all reasoning models have supportsTemperature: false', () => {
    const reasoning = MODELS.filter(m => m.id === 'o3' || m.id === 'o4-mini')
    expect(reasoning.length).toBeGreaterThan(0)
    for (const m of reasoning) {
      expect(m.supportsTemperature).toBe(false)
    }
  })
})

describe('DEFAULT_MODEL_ID', () => {
  it('resolves to a valid entry without triggering fallback', () => {
    const def = getModel(DEFAULT_MODEL_ID)
    expect(def).not.toBeNull()
    expect(def!.id).toBe(DEFAULT_MODEL_ID)
  })
})

describe('getModel', () => {
  it('returns the correct definition for a known ID', () => {
    const def = getModel('claude-sonnet-4-6')
    expect(def).not.toBeNull()
    expect(def!.provider).toBe('anthropic')
    expect(def!.supportsTemperature).toBe(true)
  })

  it('returns null for an unknown ID', () => {
    expect(getModel('unknown-model-xyz')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(getModel('')).toBeNull()
  })
})
```

- [ ] **Step 1.2 — Run tests to confirm they fail**

```bash
cd /Users/kalinovdameus/Developer/Nexus/omnichat
npm run test:run -- src/lib/models.test.ts
```

Expected: `FAIL` — error like `Cannot find module './models'`. All 7 tests fail.

- [ ] **Step 1.3 — Create `src/lib/models.ts`**

```ts
export type Provider = 'openai' | 'anthropic' | 'google' | 'xai'

export interface ModelDefinition {
  readonly id: string
  readonly label: string
  readonly provider: Provider
  readonly supportsTemperature: boolean
}

export const MODELS: readonly ModelDefinition[] = [
  // Claude 4 family
  { id: 'claude-opus-4-6',            label: 'Claude Opus 4.6',       provider: 'anthropic', supportsTemperature: true },
  { id: 'claude-sonnet-4-6',          label: 'Claude Sonnet 4.6 🔥',  provider: 'anthropic', supportsTemperature: true },
  { id: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku 4.5',      provider: 'anthropic', supportsTemperature: true },
  // Claude 3.7
  { id: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet',     provider: 'anthropic', supportsTemperature: true },
  // OpenAI GPT-4.1
  { id: 'gpt-4.1',                    label: 'GPT-4.1',                provider: 'openai',    supportsTemperature: true },
  { id: 'gpt-4.1-mini',               label: 'GPT-4.1 mini',          provider: 'openai',    supportsTemperature: true },
  // OpenAI reasoning — these do NOT accept a temperature parameter
  { id: 'o3',                         label: 'o3 (Reasoning)',         provider: 'openai',    supportsTemperature: false },
  { id: 'o4-mini',                    label: 'o4-mini (Reasoning)',    provider: 'openai',    supportsTemperature: false },
  // Google — verified via ai.google.dev/gemini-api/docs/models/gemini-3.1-pro-preview
  { id: 'gemini-3.1-pro-preview',     label: 'Gemini 3.1 Pro',        provider: 'google',    supportsTemperature: true },
  // xAI — verified via docs.x.ai/developers/models/grok-4
  { id: 'grok-4',                     label: 'Grok 4',                 provider: 'xai',       supportsTemperature: true },
]

export const DEFAULT_MODEL_ID = 'claude-sonnet-4-6'

// Startup assertion: fail fast if DEFAULT_MODEL_ID is not in MODELS
// This prevents the fallback from silently pointing at nothing.
const _check = MODELS.find(m => m.id === DEFAULT_MODEL_ID)
if (!_check) {
  throw new Error(`DEFAULT_MODEL_ID "${DEFAULT_MODEL_ID}" is not present in MODELS`)
}

/**
 * Returns the ModelDefinition for the given ID, or null if not found.
 * Callers must handle null (e.g. return HTTP 400).
 */
export function getModel(id: string): ModelDefinition | null {
  return MODELS.find(m => m.id === id) ?? null
}
```

- [ ] **Step 1.4 — Run tests and confirm all pass**

```bash
npm run test:run -- src/lib/models.test.ts
```

Expected: `7 tests passed, 0 failed`.

Note: The startup assertion (`if (!_check) throw ...`) is validated indirectly — if `DEFAULT_MODEL_ID` were removed from MODELS, the module would throw at import time and every test in the file would fail with a module load error. The "DEFAULT_MODEL_ID resolves to a valid entry" test ensures the happy path is exercised.

- [ ] **Step 1.5 — Commit**

```bash
git add src/lib/models.ts src/lib/models.test.ts
git commit -m "feat: add model registry with getModel and startup assertion"
```

---

## Chunk 2: Route Handler

> **Prerequisite:** Chunk 1 must be complete — `src/lib/models.ts` must exist before running any step here.

### Task 2: Update `route.ts` to use the registry

**Files:**
- Modify: `src/app/api/chat/route.ts`
- Modify: `src/app/api/chat/route.test.ts`

- [ ] **Step 2.1 — Update `route.test.ts`**

Replace the existing contents of `src/app/api/chat/route.test.ts` with:

```ts
import { describe, it, expect, vi } from 'vitest'
import { resolveProvider } from './route'

// Mock the AI SDKs
vi.mock('@ai-sdk/openai', () => ({
  openai: vi.fn((model) => ({ model, provider: 'openai' })),
  createOpenAI: vi.fn(() => (model: string) => ({ model, provider: 'xai' })),
}))
vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn((model) => ({ model, provider: 'anthropic' })),
}))
vi.mock('@ai-sdk/google', () => ({
  google: vi.fn((model) => ({ model, provider: 'google' })),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}))

describe('resolveProvider (backward compat wrapper)', () => {
  it('resolves claude-sonnet-4-6 to anthropic', () => {
    expect(resolveProvider('claude-sonnet-4-6').provider).toBe('anthropic')
  })

  it('resolves gpt-4.1 to openai', () => {
    expect(resolveProvider('gpt-4.1').provider).toBe('openai')
  })

  it('resolves gemini-3.1-pro-preview to google', () => {
    expect(resolveProvider('gemini-3.1-pro-preview').provider).toBe('google')
  })

  it('resolves grok-4 to xai', () => {
    expect(resolveProvider('grok-4').provider).toBe('xai')
  })

  it('falls back gracefully for unknown model (returns openai)', () => {
    // resolveProvider is a legacy wrapper — it keeps the old fallback behavior
    // so old callers don't break. The POST route itself returns 400 for unknowns.
    const result = resolveProvider('unknown-model')
    expect(result.provider).toBe('openai')
  })
})
```

- [ ] **Step 2.2 — Run the new tests to confirm they fail**

```bash
npm run test:run -- src/app/api/chat/route.test.ts
```

Expected: 4 of 5 tests fail. The new IDs (`claude-sonnet-4-6`, `gpt-4.1`, `gemini-3.1-pro-preview`, `grok-4`) are not in the old switch, so they hit the default `openai` fallback — the tests expecting `anthropic`, `openai`, `google`, `xai` will fail or produce wrong values. Only the "unknown → openai" test may accidentally pass.

- [ ] **Step 2.3 — Update `route.ts`**

Open `src/app/api/chat/route.ts`. Make these changes:

**a) Replace the imports at the top** — add the registry import alongside existing ones:

```ts
import { getModel, DEFAULT_MODEL_ID, type Provider } from '@/lib/models'
```

**b) Remove `resolveProvider` function** (lines ~18–39) and replace with:

```ts
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

function buildAiModel(id: string) {
  const def = getModel(id)!
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
```

**c) In the POST handler**, replace the model resolution block:

Find this line:
```ts
const selectedModel = model || 'gpt-4o'
```

Replace with:
```ts
const selectedModel = model || DEFAULT_MODEL_ID
const modelDef = getModel(selectedModel)
if (!modelDef) {
  return NextResponse.json({ error: `Unknown model: ${selectedModel}` }, { status: 400 })
}
const { provider } = modelDef
const apiKey = PROVIDER_ENV[modelDef.provider]
```

**d) Remove** the `const { provider, apiKey } = resolveProvider(selectedModel)` line that follows (it no longer exists — we set `provider` and `apiKey` directly above).

**e) Remove the large `switch (selectedModel)` block** that instantiates `aiModel` (lines ~174–220) and replace with:

```ts
const aiModel = buildAiModel(selectedModel)
```

**f) Update the `streamText` call** — replace the hardcoded temperature/maxTokens args:

```ts
const result = streamText({
  model: aiModel,
  messages,
  ...(modelDef.supportsTemperature ? { temperature: 1 } : {}),
  onError: (event) => { ... },
  async onFinish({ text, usage }) { ... },
})
```

Remove these old lines from streamText:
```ts
temperature: provider === 'anthropic' ? undefined : 1,
maxTokens: provider === 'openai' && (selectedModel === 'gpt-4o' || selectedModel.startsWith('o')) ? 4096 : undefined,
```

Note: the old `maxTokens: 4096` guard was a hardcoded workaround for GPT-4o only. No model in the current registry requires an explicit `maxTokens` cap, so removing it is intentional. If a future model needs a cap, add a `maxTokens` field to its `ModelDefinition` entry and spread it: `...(modelDef.maxTokens ? { maxTokens: modelDef.maxTokens } : {})`.

- [ ] **Step 2.4 — Run tests to confirm they pass**

```bash
npm run test:run -- src/app/api/chat/route.test.ts
```

Expected: all tests `PASS`.

- [ ] **Step 2.5 — Run all tests to check for regressions**

```bash
npm run test:run
```

Expected: all tests pass.

- [ ] **Step 2.6 — Commit**

```bash
git add src/app/api/chat/route.ts src/app/api/chat/route.test.ts
git commit -m "feat: refactor route to use model registry, return 400 for unknown models"
```

---

## Chunk 3: Model Switcher UI

> **Prerequisite:** Chunk 1 must be complete — `src/lib/models.ts` must exist before this step compiles.

### Task 3: Update `model-switcher.tsx` to render from registry

**Files:**
- Modify: `src/components/chat/model-switcher.tsx`

No new test file needed — the component renders `MODELS` directly and the registry is already unit-tested.

**cmdk note:** The `cmdk` library lowercases the `value` prop before passing it to `onSelect`. All model IDs in the registry are already lowercase (e.g. `gpt-4.1`, `claude-sonnet-4-6`) so this is safe. Do not add uppercase model IDs to `MODELS` without accounting for this.

- [ ] **Step 3.1 — Edit `src/components/chat/model-switcher.tsx`**

**a) Remove** the local `models` array (lines 22–39):

```ts
// DELETE this entire block:
const models = [
  { value: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet 🔥" },
  ...
]
```

**b) Add** the registry import at the top with the other imports:

```ts
import { MODELS } from '@/lib/models'
```

**c) In the JSX**, replace every reference to the local `models` array with `MODELS`. The `CommandItem` map uses `.value` from the old array — change to `.id`:

Find:
```tsx
{models.map((model) => (
  <CommandItem
    key={model.value}
    value={model.value}
    onSelect={(currentValue) => {
      console.log(">>> Frontend Pipeline: Model selected in switcher", { from: selectedModel, to: currentValue });
      onModelChange(currentValue)
      setOpen(false)
    }}
  >
    <Check
      className={cn(
        "mr-2 h-4 w-4",
        selectedModel === model.value ? "opacity-100" : "opacity-0"
      )}
    />
    <div className="flex items-center gap-2">
      {model.label}
    </div>
  </CommandItem>
))}
```

Replace with:
```tsx
{MODELS.map((model) => (
  <CommandItem
    key={model.id}
    value={model.id}
    onSelect={(currentValue) => {
      console.log(">>> Frontend Pipeline: Model selected in switcher", { from: selectedModel, to: currentValue });
      onModelChange(currentValue)
      setOpen(false)
    }}
  >
    <Check
      className={cn(
        "mr-2 h-4 w-4",
        selectedModel === model.id ? "opacity-100" : "opacity-0"
      )}
    />
    <div className="flex items-center gap-2">
      {model.label}
    </div>
  </CommandItem>
))}
```

**d) Update the trigger display** — find the line that looks up the selected model label:

```tsx
? models.find((model) => model.value === selectedModel)?.label || selectedModel
```

Replace with:

```tsx
? MODELS.find((model) => model.id === selectedModel)?.label || selectedModel
```

**e) Update the GPT sparkle icon check** — this line is still fine since it checks `selectedModel` directly, but confirm it still makes sense with `gpt-4.1`:

```tsx
{selectedModel.startsWith('gpt-') && <Sparkles className="size-3.5 text-yellow-500" />}
```

This works as-is — no change needed.

- [ ] **Step 3.2 — Run all tests to confirm nothing broke**

```bash
npm run test:run
```

Expected: all pass.

- [ ] **Step 3.3 — Start dev server and manually verify**

```bash
npm run dev
```

Open `http://localhost:3000`. Check:
- [ ] Model switcher dropdown shows all 10 models
- [ ] Selecting `Claude Sonnet 4.6 🔥` and sending a message works (no error)
- [ ] Selecting `o3` and sending a message works (no temperature error in server logs)
- [ ] Selecting `Gemini 3.1 Pro` and sending a message works
- [ ] Selecting `Grok 4` and sending a message works

- [ ] **Step 3.4 — Commit**

```bash
git add src/components/chat/model-switcher.tsx
git commit -m "feat: model-switcher renders from registry — remove local model list"
```

---

## Done

Three files changed, one file created. The registry is now the single source of truth. Adding a new model in the future requires one new entry in `src/lib/models.ts` only.
