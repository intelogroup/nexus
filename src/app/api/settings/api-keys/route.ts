import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/settings/api-keys — list masked API keys for the current user
 * POST /api/settings/api-keys — add a new API key
 * DELETE /api/settings/api-keys — revoke an API key by id
 */

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, label, masked_key, created_at, last_used_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { label: string; key: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.label || typeof body.label !== 'string' || body.label.trim().length === 0) {
    return NextResponse.json({ error: 'Label is required' }, { status: 400 })
  }
  if (!body.key || typeof body.key !== 'string' || body.key.trim().length < 8) {
    return NextResponse.json({ error: 'API key must be at least 8 characters' }, { status: 400 })
  }

  const masked = '****' + body.key.slice(-4)

  // Hash the key with SHA-256 before storing
  const encoder = new TextEncoder()
  const keyData = encoder.encode(body.key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyData)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

  const { data, error } = await supabase
    .from('api_keys')
    .insert({
      user_id: user.id,
      label: body.label.trim(),
      key_hash: keyHash,
      masked_key: masked,
    })
    .select('id, label, masked_key, created_at')
    .single()

  if (error) return NextResponse.json({ error: 'Failed to save API key' }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { id: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.id || typeof body.id !== 'string') {
    return NextResponse.json({ error: 'Key ID is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('api_keys')
    .delete()
    .eq('id', body.id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'Failed to revoke API key' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
