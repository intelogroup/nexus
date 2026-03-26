"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Key, Bell, Plus, Trash2, Eye, EyeOff, Loader2, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

// ---------- Types ----------

interface ApiKey {
  id: string
  label: string
  masked_key: string
  created_at: string
  last_used_at: string | null
}

interface NotificationPreferences {
  email_notifications: boolean
  push_notifications: boolean
  research_alerts: boolean
  knowledge_gap_alerts: boolean
}

// ---------- Toggle component ----------

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        data-testid={`toggle-${label.toLowerCase().replace(/\s+/g, '-')}`}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
          checked ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  )
}

// ---------- Settings page ----------

export default function SettingsPage() {
  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [keysLoading, setKeysLoading] = useState(true)
  const [newLabel, setNewLabel] = useState("")
  const [newKey, setNewKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [addingKey, setAddingKey] = useState(false)
  const [keyError, setKeyError] = useState<string | null>(null)

  // Notification prefs state
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    email_notifications: true,
    push_notifications: true,
    research_alerts: true,
    knowledge_gap_alerts: true,
  })
  const [prefsLoading, setPrefsLoading] = useState(true)
  const [prefsSaving, setPrefsSaving] = useState(false)

  // Fetch API keys
  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/api-keys")
      if (res.ok) {
        setApiKeys(await res.json())
      }
    } catch {
      // silent
    } finally {
      setKeysLoading(false)
    }
  }, [])

  // Fetch preferences
  const fetchPrefs = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/preferences")
      if (res.ok) {
        setPrefs(await res.json())
      }
    } catch {
      // silent
    } finally {
      setPrefsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchKeys()
    fetchPrefs()
  }, [fetchKeys, fetchPrefs])

  // Add API key
  const handleAddKey = async () => {
    setKeyError(null)
    if (!newLabel.trim()) {
      setKeyError("Label is required")
      return
    }
    if (!newKey.trim() || newKey.trim().length < 8) {
      setKeyError("API key must be at least 8 characters")
      return
    }

    setAddingKey(true)
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel.trim(), key: newKey.trim() }),
      })
      if (res.ok) {
        setNewLabel("")
        setNewKey("")
        setShowKey(false)
        fetchKeys()
      } else {
        const data = await res.json()
        setKeyError(data.error || "Failed to add key")
      }
    } catch {
      setKeyError("Network error")
    } finally {
      setAddingKey(false)
    }
  }

  // Revoke API key
  const handleRevokeKey = async (id: string) => {
    if (!confirm("Are you sure you want to revoke this API key?")) return

    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setApiKeys((prev) => prev.filter((k) => k.id !== id))
      }
    } catch {
      // silent
    }
  }

  // Queue-based preference updates to prevent race conditions
  const prefSaveQueue = useRef<Record<string, boolean>>({})
  const prefSaving = useRef(false)

  const flushPrefQueue = useCallback(async () => {
    if (prefSaving.current) return
    const pending = { ...prefSaveQueue.current }
    if (Object.keys(pending).length === 0) {
      setPrefsSaving(false)
      return
    }
    prefSaveQueue.current = {}
    prefSaving.current = true
    try {
      const res = await fetch("/api/settings/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pending),
      })
      if (!res.ok) {
        // Revert all pending changes on error
        setPrefs((prev) => {
          const reverted = { ...prev }
          for (const [k, v] of Object.entries(pending)) {
            (reverted as Record<string, boolean>)[k] = !v
          }
          return reverted
        })
      }
    } catch {
      // Revert on network error
      setPrefs((prev) => {
        const reverted = { ...prev }
        for (const [k, v] of Object.entries(pending)) {
          (reverted as Record<string, boolean>)[k] = !v
        }
        return reverted
      })
    } finally {
      prefSaving.current = false
      // If more changes queued while we were saving, flush again
      if (Object.keys(prefSaveQueue.current).length > 0) {
        flushPrefQueue()
      } else {
        setPrefsSaving(false)
      }
    }
  }, [])

  const handleTogglePref = useCallback((key: keyof NotificationPreferences, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }))
    setPrefsSaving(true)
    prefSaveQueue.current[key] = value
    // Debounce: wait briefly for more toggles before sending
    setTimeout(() => flushPrefQueue(), 300)
  }, [flushPrefQueue])

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto py-8 px-4 sm:px-6 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Settings2 className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        </div>

        {/* API Keys Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              API Keys
            </CardTitle>
            <CardDescription>
              Manage API keys for external integrations. Keys are masked after creation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add new key form */}
            <div className="space-y-3 p-4 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Label (e.g. Production)"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  className="flex-1"
                  data-testid="api-key-label-input"
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showKey ? "text" : "password"}
                    placeholder="API key"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    className="pr-10"
                    data-testid="api-key-value-input"
                  />
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() => setShowKey(!showKey)}
                    type="button"
                  >
                    {showKey ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  </Button>
                </div>
                <Button
                  onClick={handleAddKey}
                  disabled={addingKey}
                  size="sm"
                  data-testid="add-api-key-btn"
                >
                  {addingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  <span className="ml-1">Add</span>
                </Button>
              </div>
              {keyError && (
                <p className="text-xs text-destructive" data-testid="api-key-error">{keyError}</p>
              )}
            </div>

            <Separator />

            {/* Key list */}
            {keysLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : apiKeys.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No API keys configured yet.
              </p>
            ) : (
              <div className="space-y-2">
                {apiKeys.map((k) => (
                  <div
                    key={k.id}
                    data-testid="api-key-item"
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-background px-4 py-3"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{k.label}</span>
                      <code className="text-xs text-muted-foreground font-mono">{k.masked_key}</code>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleRevokeKey(k.id)}
                      data-testid="revoke-api-key-btn"
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notification Preferences Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notification Preferences
              {prefsSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </CardTitle>
            <CardDescription>
              Choose how and when you receive notifications.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {prefsLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="divide-y">
                <Toggle
                  label="Email Notifications"
                  description="Receive notifications via email"
                  checked={prefs.email_notifications}
                  onChange={(v) => handleTogglePref("email_notifications", v)}
                />
                <Toggle
                  label="Push Notifications"
                  description="Receive browser push notifications"
                  checked={prefs.push_notifications}
                  onChange={(v) => handleTogglePref("push_notifications", v)}
                />
                <Toggle
                  label="Research Alerts"
                  description="Get notified when research tasks complete"
                  checked={prefs.research_alerts}
                  onChange={(v) => handleTogglePref("research_alerts", v)}
                />
                <Toggle
                  label="Knowledge Gap Alerts"
                  description="Get notified when knowledge gaps are discovered"
                  checked={prefs.knowledge_gap_alerts}
                  onChange={(v) => handleTogglePref("knowledge_gap_alerts", v)}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
