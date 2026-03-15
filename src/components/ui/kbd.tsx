import { cn } from "@lib/utils"
import type * as React from "react"

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-md border bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground shadow-xs",
        className,
      )}
      {...props}
    />
  )
}

export { Kbd }
