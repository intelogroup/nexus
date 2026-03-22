import { describe, it, expect, vi, beforeEach } from 'vitest'
import { messagesToMarkdown, messagesToHtml, downloadFile, type ExportMessage } from './chat-export'

const sampleMessages: ExportMessage[] = [
  {
    id: '1',
    role: 'user',
    content: 'Hello, how are you?',
    createdAt: '2025-01-01T10:00:00Z',
  },
  {
    id: '2',
    role: 'assistant',
    content: 'I am doing well, thank you!',
    createdAt: '2025-01-01T10:00:05Z',
    model_used: 'gpt-4',
  },
]

describe('messagesToMarkdown', () => {
  it('generates markdown with title', () => {
    const md = messagesToMarkdown(sampleMessages, 'Test Chat')
    expect(md).toContain('# Test Chat')
    expect(md).toContain('**You**')
    expect(md).toContain('**Assistant**')
    expect(md).toContain('Hello, how are you?')
    expect(md).toContain('I am doing well, thank you!')
    expect(md).toContain('_(gpt-4)_')
  })

  it('generates markdown without title', () => {
    const md = messagesToMarkdown(sampleMessages)
    // Should not have a top-level heading (but will have ### sub-headings)
    expect(md).not.toMatch(/^# /m)
    expect(md).toContain('**You**')
  })

  it('handles empty messages', () => {
    const md = messagesToMarkdown([])
    expect(md).toContain('Exported on')
    expect(md).toContain('---')
  })

  it('includes timestamps when available', () => {
    const md = messagesToMarkdown(sampleMessages)
    // The output should contain formatted dates
    expect(md).toContain(' — ')
  })

  it('skips model tag for messages without model_used', () => {
    const md = messagesToMarkdown([sampleMessages[0]])
    expect(md).not.toContain('_(')
  })
})

describe('messagesToHtml', () => {
  it('generates valid HTML with title', () => {
    const html = messagesToHtml(sampleMessages, 'Test Chat')
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<title>Test Chat</title>')
    expect(html).toContain('You')
    expect(html).toContain('Assistant')
    expect(html).toContain('Hello, how are you?')
  })

  it('escapes HTML entities in content', () => {
    const msgs: ExportMessage[] = [
      { id: '1', role: 'user', content: '<script>alert("xss")</script>' },
    ]
    const html = messagesToHtml(msgs)
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('uses fallback title when none provided', () => {
    const html = messagesToHtml(sampleMessages)
    expect(html).toContain('<title>Chat Export</title>')
  })

  it('includes model info for assistant messages', () => {
    const html = messagesToHtml(sampleMessages)
    expect(html).toContain('gpt-4')
  })
})

describe('downloadFile', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('creates and clicks a download link', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:test')
    const revokeObjectURL = vi.fn()
    const mockClick = vi.fn()
    const mockAppendChild = vi.fn()
    const mockRemoveChild = vi.fn()

    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: mockClick,
    } as any)
    vi.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild)
    vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild)

    downloadFile('hello', 'test.md', 'text/markdown')

    expect(createObjectURL).toHaveBeenCalled()
    expect(mockClick).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test')
  })
})
