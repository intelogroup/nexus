/**
 * Standalone domain classification backfill script.
 * Signs in via Supabase REST, builds the SSR cookie, and calls
 * POST /api/knowledge/classify-domains in batches until done.
 *
 * Usage: node scripts/backfill-domains.mjs
 */

const SUPABASE_URL = 'https://etqcbdrwmfacsaqegwzd.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0cWNiZHJ3bWZhY3NhcWVnd3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MTYzMDMsImV4cCI6MjA4OTA5MjMwM30.y05Riu3-QIUhIbL3j-sz0WrlrjLLOIbk4W_OxdMqzK4';
const EMAIL = 'jayveedz19@gmail.com';
const PASSWORD = 'Jimkali90#';
const API_BASE = 'http://localhost:3000';
const BATCH_SIZE = 10;

function toBase64URL(str) {
  return Buffer.from(str).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function signIn() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'apikey': ANON_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Sign-in failed: ${await res.text()}`);
  return res.json();
}

async function classifyBatch(cookieHeader, offset) {
  const res = await fetch(`${API_BASE}/api/knowledge/classify-domains?limit=${BATCH_SIZE}&offset=${offset}`, {
    method: 'POST',
    headers: { 'Cookie': cookieHeader },
  });
  if (res.status === 401) throw new Error('Unauthorized — cookie invalid');
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  return res.json();
}

async function main() {
  console.log('Signing in…');
  const session = await signIn();
  console.log(`Signed in as ${EMAIL}`);

  // Build Supabase SSR cookie: sb-<ref>-auth-token = base64-<base64url(JSON)>
  const storageKey = 'sb-etqcbdrwmfacsaqegwzd-auth-token';
  const sessionJson = JSON.stringify({
    access_token: session.access_token,
    token_type: 'bearer',
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    refresh_token: session.refresh_token,
    user: session.user,
  });
  const cookieValue = 'base64-' + toBase64URL(sessionJson);
  const cookieHeader = `${storageKey}=${cookieValue}`;

  let offset = 0;
  let totalClassified = 0;
  let batch = 0;

  while (true) {
    batch++;
    process.stdout.write(`Batch ${batch} (offset=${offset})… `);
    const result = await classifyBatch(cookieHeader, offset);
    totalClassified += result.classified ?? 0;
    console.log(`classified=${result.classified}  done=${result.done}`);

    if (result.done) break;
    offset += BATCH_SIZE;

    // Small delay to avoid hammering OpenAI rate limits
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\nBackfill complete. Total classified: ${totalClassified}`);
}

main().catch(err => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});
