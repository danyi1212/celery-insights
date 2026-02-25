import { cn } from "@lib/utils"
import React from "react"

interface PanelPaperProps extends React.ComponentProps<"div"> {
    children?: React.ReactNode
}

const PanelPaper: React.FC<PanelPaperProps> = ({ children, className, ...props }) => (
    <div className={cn("h-full overflow-auto rounded-3xl bg-card p-1", className)} {...props}>
        {children}
    </div>
)

export default PanelPaper
