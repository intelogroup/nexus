"use client"

import { Download, FileText, FileDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { exportAsMarkdown, exportAsPdf, type ExportMessage } from "@/lib/chat-export"

interface ChatExportMenuProps {
  messages: ExportMessage[]
  title?: string
}

export function ChatExportMenu({ messages, title }: ChatExportMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={(props) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2 text-muted-foreground"
            data-testid="chat-export-btn"
            {...props}
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline text-xs">Export</span>
          </Button>
        )}
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          data-testid="export-markdown-btn"
          onClick={() => exportAsMarkdown(messages, title)}
        >
          <FileText className="mr-2 h-4 w-4" />
          Export as Markdown
        </DropdownMenuItem>
        <DropdownMenuItem
          data-testid="export-pdf-btn"
          onClick={() => exportAsPdf(messages, title)}
        >
          <FileDown className="mr-2 h-4 w-4" />
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
