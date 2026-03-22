import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/settings/preferences — get notification preferences
 * PATCH /api/settings/preferences — update notification preferences
 */

export interface NotificationPreferences {
  email_notifications: boolean
  push_notifications: boolean
  research_alerts: boolean
  knowledge_gap_alerts: boolean
}

const DEFAULT_PREFERENCES: NotificationPreferences = {
  email_notifications: true,
  push_notifications: true,
  research_alerts: true,
  knowledge_gap_alerts: true,
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('user_preferences')
    .select('preferences')
    .eq('user_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 })
  }

  return NextResponse.json(data?.preferences ?? DEFAULT_PREFERENCES)
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Partial<NotificationPreferences>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Validate — only accept known boolean fields
  const validKeys = ['email_notifications', 'push_notifications', 'research_alerts', 'knowledge_gap_alerts']
  const filtered: Record<string, boolean> = {}
  for (const [k, v] of Object.entries(body)) {
    if (validKeys.includes(k) && typeof v === 'boolean') {
      filtered[k] = v
    }
  }

  if (Object.keys(filtered).length === 0) {
    return NextResponse.json({ error: 'No valid preferences provided' }, { status: 400 })
  }

  // Upsert preferences
  const { data: existing } = await supabase
    .from('user_preferences')
    .select('preferences')
    .eq('user_id', user.id)
    .single()

  const merged = { ...DEFAULT_PREFERENCES, ...(existing?.preferences ?? {}), ...filtered }

  const { error } = await supabase
    .from('user_preferences')
    .upsert({
      user_id: user.id,
      preferences: merged,
    }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 })
  return NextResponse.json(merged)
}
