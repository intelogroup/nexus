"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

function InputGroup({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      className={cn(
        "flex h-9 w-full items-center rounded-md border bg-transparent shadow-xs transition-[color,box-shadow] has-[:focus-visible]:border-ring has-[:focus-visible]:ring-ring/50 has-[:focus-visible]:ring-[3px] has-[:disabled]:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

function InputGroupAddon({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group-addon"
      className={cn(
        "text-muted-foreground flex shrink-0 items-center px-3 [&_svg]:size-4 [&_svg]:shrink-0",
        className
      )}
      {...props}
    />
  )
}

function InputGroupInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <input
      data-slot="input-group-input"
      className={cn(
        "placeholder:text-muted-foreground flex h-full w-full bg-transparent px-3 py-1 text-base outline-none disabled:cursor-not-allowed md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { InputGroup, InputGroupAddon, InputGroupInput }
