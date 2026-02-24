import { Input } from "@components/ui/input"
import { Button } from "@components/ui/button"
import { Search, X } from "lucide-react"
import React from "react"

interface FacetQuickFilterProps {
    filter: string
    setFilter: (value: string) => void
}

const FacetQuickFilter: React.FC<FacetQuickFilterProps> = ({ filter, setFilter }) => {
    return (
        <div className="relative p-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
                placeholder="Filter values..."
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                className="h-8 pl-8 pr-8 text-sm"
            />
            {filter && (
                <Button
                    variant="ghost"
                    size="icon-xs"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setFilter("")}
                >
                    <X className="size-3.5" />
                </Button>
            )}
        </div>
    )
}

export default FacetQuickFilter
