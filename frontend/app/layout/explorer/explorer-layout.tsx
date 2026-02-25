import { Button } from "@components/ui/button"
import { Separator } from "@components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { ArrowLeft, ArrowRight } from "lucide-react"
import React, { useState } from "react"

interface ExplorerLayoutProps {
    facets?: React.ReactNode
    actions?: React.ReactNode
    children?: React.ReactNode
}

const FACET_WIDTH = 300
export const ExplorerLayout: React.FC<ExplorerLayoutProps> = ({ facets, actions, children }) => {
    const [isFacetMenuOpen, setFacetMenuOpen] = useState(true)

    return (
        <div className="flex flex-row">
            <div
                className="overflow-hidden transition-[width] duration-300"
                style={{ width: isFacetMenuOpen ? FACET_WIDTH : 0 }}
            >
                <div className="flex h-12 items-center px-4">
                    <h5 className="text-lg font-semibold">Facets</h5>
                </div>
                <Separator />
                {facets}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex h-12 items-center px-2">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => setFacetMenuOpen(!isFacetMenuOpen)}>
                                {isFacetMenuOpen ? <ArrowLeft className="size-4" /> : <ArrowRight className="size-4" />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>{isFacetMenuOpen ? "Hide facets" : "Show facets"}</TooltipContent>
                    </Tooltip>
                    <div className="flex-1" />
                    <div className="flex items-center gap-2">{actions}</div>
                </div>
                {children}
            </div>
        </div>
    )
}
