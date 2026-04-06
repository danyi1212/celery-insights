import FilterSearch from "@components/explorer/filter-search"
import FilterValue from "@components/explorer/filter-value"
import { Button } from "@components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@components/ui/collapsible"
import { ScrollArea } from "@components/ui/scroll-area"
import { Separator } from "@components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { ChevronDown, ChevronUp, ListX } from "lucide-react"
import React, { useState } from "react"

interface FilterSectionProps {
  title: string
  counts: Map<string, number>
  selected: Set<string>
  setSelected: (value: Set<string>) => void
  valueFormatter?: (value: string) => React.ReactElement | string
}

const FILTER_MAX_HEIGHT = 42 * 8 // 8 list items

const FilterSection: React.FC<FilterSectionProps> = ({ title, counts, selected, setSelected, valueFormatter }) => {
  const [isOpen, setOpen] = useState<boolean>(true)
  const [isHover, setHover] = useState<boolean>(false)
  const [filter, setFilter] = useState<string>("")

  const handleSelect = (value: string) => {
    if (selected.has(value)) {
      const newSelected = new Set(selected)
      newSelected.delete(value)
      setSelected(newSelected)
    } else {
      setSelected(new Set(selected).add(value))
    }
  }

  const handleClearAll = () => setSelected(new Set())

  return (
    <Collapsible open={isOpen || isHover} onOpenChange={setOpen}>
      <div onMouseEnter={() => setHover(!isOpen)} onMouseLeave={() => setHover(false)}>
        <div className="flex items-center">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon-xs">
              {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </Button>
          </CollapsibleTrigger>
          <h6 className="flex-1 truncate text-base font-semibold">{title}</h6>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="mx-1"
                aria-label="Clear selection"
                onClick={() => handleClearAll()}
              >
                <ListX className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear selection</TooltipContent>
          </Tooltip>
        </div>
        <Separator />
        <CollapsibleContent>
          <FilterSearch filter={filter} setFilter={setFilter} />
          <ScrollArea className="w-full" style={{ maxHeight: FILTER_MAX_HEIGHT }}>
            <ul>
              {Array.from(counts.entries())
                .filter(([value]) => !filter || value.toLowerCase().includes(filter.toLowerCase()))
                .sort((a, b) => b[1] - a[1])
                .map(([value, count]) => (
                  <FilterValue
                    key={value}
                    value={value}
                    label={valueFormatter ? valueFormatter(value) : value}
                    count={count}
                    selected={selected}
                    onSelect={() => handleSelect(value)}
                  />
                ))}
            </ul>
          </ScrollArea>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
export default FilterSection
