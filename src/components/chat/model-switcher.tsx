"use client";

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const models = [
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "claude-3-5-sonnet-20240620", label: "Claude 3.5 Sonnet" },
  { value: "models/gemini-1.5-pro", label: "Gemini 1.5 Pro" },
  { value: "grok-2", label: "Grok 2" },
]

interface ModelSwitcherProps {
  activeModel: string;
  onModelChange: (model: string) => void;
}

export function ModelSwitcher({ activeModel, onModelChange }: ModelSwitcherProps) {
  const selectedModel = models.find((model) => model.value === activeModel) || models[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: "outline" }), "w-[200px] justify-between")}
        role="combobox"
      >
        {selectedModel.label}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[200px] p-0">
        {models.map((model) => (
          <DropdownMenuItem
            key={model.value}
            onSelect={() => onModelChange(model.value)}
            className="flex items-center justify-between cursor-pointer"
          >
            {model.label}
            {activeModel === model.value && (
              <Check className="h-4 w-4" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}