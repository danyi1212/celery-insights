import { LockKeyhole } from "lucide-react"

export default function RestrictedData({ label = "This data" }: { label?: string }) {
  return (
    <p className="flex items-start gap-2 p-3 text-sm text-muted-foreground">
      <LockKeyhole className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>Access to {label.toLowerCase()} is restricted.</span>
    </p>
  )
}
