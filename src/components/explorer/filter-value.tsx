import { cn } from "@lib/utils"
import { CheckIcon } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import React from "react"

interface FilterValueProps {
  value: string
  label: React.ReactElement | string
  count: number
  onSelect: () => void
  selected: Set<string>
}

const FilterValue: React.FC<FilterValueProps> = ({ value, count, selected, onSelect, label }) => (
  <li className="flex items-center">
    <button
      type="button"
      className="flex w-full items-center gap-2 px-2 py-1 text-left hover:bg-accent/50 transition-colors"
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onSelect()
        }
      }}
    >
      <span
        aria-hidden="true"
        className={cn(
          "border-input dark:bg-input/30 size-4 shrink-0 rounded-[4px] border shadow-xs",
          selected.size > 0 && selected.has(value) && "border-primary bg-primary text-primary-foreground",
        )}
      >
        {selected.size > 0 && selected.has(value) ? <CheckIcon className="size-3.5" /> : null}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="max-w-[80%] truncate text-xs">{label}</span>
        </TooltipTrigger>
        <TooltipContent side="right">{value}</TooltipContent>
      </Tooltip>
      <span className="ml-auto text-sm text-muted-foreground">{count}</span>
    </button>
  </li>
)
export default FilterValue
