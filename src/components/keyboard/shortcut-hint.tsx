import { Kbd } from "@components/ui/kbd"
import { cn } from "@lib/utils"
import type { ShortcutTrigger } from "@hooks/use-keyboard-shortcuts"

const isApplePlatform = () => typeof navigator !== "undefined" && /(mac|iphone|ipad|ipod)/i.test(navigator.userAgent)

const formatKey = (key: string) => {
  const normalizedKey = key.toLowerCase()

  if (normalizedKey === " ") {
    return "Space"
  }

  if (normalizedKey === "escape") {
    return "Esc"
  }

  if (normalizedKey === "arrowup") {
    return "Up"
  }

  if (normalizedKey === "arrowdown") {
    return "Down"
  }

  if (normalizedKey === "arrowleft") {
    return "Left"
  }

  if (normalizedKey === "arrowright") {
    return "Right"
  }

  return key.length === 1 && /[a-z]/i.test(key) ? key.toUpperCase() : key
}

const getTriggerTokens = (trigger: ShortcutTrigger) => {
  const tokens: string[] = []

  if (trigger.mod) {
    tokens.push(isApplePlatform() ? "Cmd" : "Ctrl")
  }

  if (trigger.alt) {
    tokens.push(isApplePlatform() ? "Opt" : "Alt")
  }

  if (trigger.shift) {
    tokens.push("Shift")
  }

  tokens.push(formatKey(trigger.key))

  return tokens
}

interface ShortcutHintProps {
  className?: string
  sequence: ShortcutTrigger[]
}

export const ShortcutHint = ({ className, sequence }: ShortcutHintProps) => {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-muted-foreground", className)}>
      {sequence.map((trigger, index) => (
        <span key={`${trigger.key}-${index}`} className="inline-flex items-center gap-1">
          {getTriggerTokens(trigger).map((token) => (
            <Kbd key={token}>{token}</Kbd>
          ))}
          {index < sequence.length - 1 ? <span className="text-xs">then</span> : null}
        </span>
      ))}
    </span>
  )
}
