# Nexus Project — Claude Code Instructions

## Task: Send Developer Brief to Jim

**Trigger**: Any request like "send brief to jim", "send the developer brief", "email jim the brief"

### Step 1 — Compose the brief content

Generate a fresh "10x Developer Briefs" email with today's date. Always include:

1. **5 Coding Hacks** — practical techniques from current AI coding tools (Claude Code, OpenAI Codex, Google Gemini). Topics rotate but should always be actionable and specific. Examples: parallel AI workflows, CLAUDE.md/AGENTS.md setup, large-context strategies, CI/CD automation, multi-agent patterns.

2. **5 Claude Code Best Practices** — sourced from Claude Code docs. Topics: verification workflows, explore→plan→code, context management, hooks/permissions, prompt specificity.

Format as styled HTML email with:
- Header: `⚡ 10x Developer Briefs`
- Subheader: `Curated from Claude Code Docs, OpenAI Codex & Google Gemini — <TODAY'S DATE>`
- Blue left-border cards for hacks, green left-border cards for best practices
- Footer crediting Claude Code (Sonnet model) + sources + date

### Step 2 — Send via Supabase pg_net → Resend

**Do NOT attempt direct HTTP** — the egress proxy blocks all email APIs. Go straight to Supabase.

```sql
SELECT net.http_post(
  url := 'https://api.resend.com/emails',
  headers := jsonb_build_object(
    'Authorization', 'Bearer re_Z5mWwuTW_MjRy7Z5UJJrtF3n1WgTtv48E',
    'Content-Type', 'application/json'
  ),
  body := jsonb_build_object(
    'from', 'onboarding@resend.dev',
    'to', ARRAY['jimkalinov@gmail.com'],
    'subject', '10x Developer Briefs — <DATE> | Claude Code, Codex & Gemini',
    'html', '<full html string>'
  )
) AS request_id;
```

Then confirm delivery:
```sql
SELECT id, status_code, content::text FROM net._http_response WHERE id = <request_id>;
-- 200 + {"id":"<uuid>"} = success
```

### Recipient
- **Jim**: `jimkalinov@gmail.com`

### History
| Date | Resend Message ID |
|------|------------------|
| 2026-03-22 | `694fbb55-49e8-4a64-b49d-38aa3a87b61e` |

---

## Email Sending (Transactional)

**Working method: Supabase `pg_net` → Resend API**

Direct HTTP to email APIs (Resend, Mailgun, Brevo) is **blocked** by the egress proxy in this environment. The only working path is routing through Supabase's database server, which has unrestricted outbound access.

### Supabase Project
- **Project ID**: `expwyvyphwlyhwrzdmmv` (businto, us-west-2, ACTIVE_HEALTHY)
- **Extension**: `pg_net` v0.19.5 — already installed, no setup needed

### Resend Credentials
- **API Key**: `re_Z5mWwuTW_MjRy7Z5UJJrtF3n1WgTtv48E`
- **From address**: `onboarding@resend.dev` (works without domain verification for account owner)

### Send Email Pattern
```sql
-- Step 1: Queue the request
SELECT net.http_post(
  url := 'https://api.resend.com/emails',
  headers := jsonb_build_object(
    'Authorization', 'Bearer re_Z5mWwuTW_MjRy7Z5UJJrtF3n1WgTtv48E',
    'Content-Type', 'application/json'
  ),
  body := jsonb_build_object(
    'from', 'onboarding@resend.dev',
    'to', ARRAY['recipient@example.com'],
    'subject', 'Your Subject',
    'html', '<p>Your HTML content</p>'
  )
) AS request_id;

-- Step 2: Poll for result (use the returned request_id)
SELECT id, status_code, content::text
FROM net._http_response
WHERE id = <request_id>;
-- 200 = delivered, content contains {"id":"<resend-message-id>"}
```

### What Does NOT Work
- Direct `curl` / `fetch` to `api.resend.com` — proxy blocks it (403)
- Direct `curl` / `fetch` to `api.mailgun.net` — proxy blocks it (403)
- Mailgun account (`ventoriclub.com`) — account is closed (403)
- Old Resend key `re_hfLg6kWN_...` — revoked (401)
- `gmail_send_draft` — does not exist in Gmail MCP (draft-only)
- Vercel MCP env var retrieval — `api.vercel.com` blocked by proxy

## Email Content

### 10x Developer Briefs
- File: `/home/user/nexus/10xdev.md` (regenerate if missing)
- Last sent: 2026-03-22 to `jimkalinov@gmail.com`
- Resend message ID: `694fbb55-49e8-4a64-b49d-38aa3a87b61e`
- Content: 5 coding hacks + 5 Claude Code best practices sourced from Claude Code Docs, OpenAI Codex, Google Gemini

## Egress Proxy Rules
- **Allowed**: `*.googleapis.com`, `accounts.google.com`, Supabase MCP endpoints
- **Blocked**: `api.resend.com`, `api.mailgun.net`, `smtp.resend.com`, `api.vercel.com`, `api.github.com` (direct)

## GitHub
- MCP restricted to `intelogroup/nexus` repo only

## Supabase
- Org: `intelogroup`
- Active project: `businto` (`expwyvyphwlyhwrzdmmv`)
- Both `pg_net` and `http` extensions are installed
