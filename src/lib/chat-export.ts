/**
 * Chat export utilities — converts chat messages to Markdown or PDF (via HTML).
 */

export interface ExportMessage {
  id: string
  role: string
  content: string
  createdAt?: string
  model_used?: string
}

/**
 * Generate a markdown string from chat messages.
 */
export function messagesToMarkdown(
  messages: ExportMessage[],
  title?: string
): string {
  const lines: string[] = []

  if (title) {
    lines.push(`# ${title}`)
    lines.push("")
  }

  lines.push(`_Exported on ${new Date().toLocaleString()}_`)
  lines.push("")
  lines.push("---")
  lines.push("")

  for (const msg of messages) {
    const roleLabel = msg.role === "user" ? "**You**" : "**Assistant**"
    const modelTag = msg.model_used ? ` _(${msg.model_used})_` : ""
    const timestamp = msg.createdAt
      ? ` — ${new Date(msg.createdAt).toLocaleString()}`
      : ""

    lines.push(`### ${roleLabel}${modelTag}${timestamp}`)
    lines.push("")
    lines.push(msg.content)
    lines.push("")
    lines.push("---")
    lines.push("")
  }

  return lines.join("\n")
}

/**
 * Trigger a file download in the browser.
 */
export function downloadFile(
  content: string,
  filename: string,
  mimeType: string
) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Export chat as markdown file download.
 */
export function exportAsMarkdown(
  messages: ExportMessage[],
  title?: string
) {
  const md = messagesToMarkdown(messages, title)
  const filename = `chat-${title ? title.slice(0, 30).replace(/[^a-zA-Z0-9]/g, "-") : "export"}-${Date.now()}.md`
  downloadFile(md, filename, "text/markdown")
}

/**
 * Generate simple HTML for PDF-like export.
 */
export function messagesToHtml(
  messages: ExportMessage[],
  title?: string
): string {
  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

  const msgHtml = messages
    .map((msg) => {
      const isUser = msg.role === "user"
      const roleLabel = isUser ? "You" : "Assistant"
      const modelTag = msg.model_used ? ` <em>(${escapeHtml(msg.model_used)})</em>` : ""
      const bg = isUser ? "#f3f4f6" : "#ffffff"
      const border = isUser ? "#6366f1" : "#e5e7eb"

      return `
      <div style="margin-bottom:16px;padding:12px 16px;border-left:3px solid ${border};background:${bg};border-radius:4px;">
        <div style="font-weight:600;margin-bottom:8px;font-size:13px;color:#6b7280;">
          ${roleLabel}${modelTag}
        </div>
        <div style="white-space:pre-wrap;font-size:14px;line-height:1.6;">${escapeHtml(msg.content)}</div>
      </div>`
    })
    .join("\n")

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title ? escapeHtml(title) : "Chat Export"}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; color: #1f2937; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .meta { color: #9ca3af; font-size: 12px; margin-bottom: 24px; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
  </style>
</head>
<body>
  <h1>${title ? escapeHtml(title) : "Chat Export"}</h1>
  <div class="meta">Exported on ${new Date().toLocaleString()}</div>
  <hr>
  ${msgHtml}
</body>
</html>`
}

/**
 * Export chat as PDF by opening HTML in a new window and triggering print.
 * Uses DOM methods to safely populate the new window content.
 */
export function exportAsPdf(
  messages: ExportMessage[],
  title?: string
) {
  const html = messagesToHtml(messages, title)
  const blob = new Blob([html], { type: "text/html" })
  const blobUrl = URL.createObjectURL(blob)
  const printWindow = window.open(blobUrl, "_blank")

  if (!printWindow) {
    // Fallback: download as HTML if popup blocked
    URL.revokeObjectURL(blobUrl)
    const filename = `chat-${title ? title.slice(0, 30).replace(/[^a-zA-Z0-9]/g, "-") : "export"}-${Date.now()}.html`
    downloadFile(html, filename, "text/html")
    return
  }

  // Trigger print after content loads
  printWindow.addEventListener("load", () => {
    printWindow.print()
    URL.revokeObjectURL(blobUrl)
  })
}
