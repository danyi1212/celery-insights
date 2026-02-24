import { Checkbox } from "@components/ui/checkbox"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import React from "react"

interface FacetValueProps {
    value: string
    label: React.ReactElement | string
    count: number
    onSelect: () => void
    selected: Set<string>
}

const FacetValue: React.FC<FacetValueProps> = ({ value, count, selected, onSelect, label }) => (
    <li className="flex items-center">
        <button
            type="button"
            className="flex w-full items-center gap-2 px-2 py-1 text-left hover:bg-accent/50 transition-colors"
            onClick={onSelect}
        >
            <Checkbox
                checked={selected.size === 0 || selected.has(value)}
                tabIndex={-1}
                className="pointer-events-none"
            />
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
export default FacetValue
