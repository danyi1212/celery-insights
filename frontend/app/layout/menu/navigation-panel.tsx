import { cn } from "@lib/utils"
import React from "react"

interface NavigationPanelProps extends React.PropsWithChildren {
    active: boolean
    inactivePosition: "left" | "right"
}

const NavigationPanel: React.FC<NavigationPanelProps> = ({ active, inactivePosition, children }) => {
    const inactiveClass = inactivePosition === "left" ? "-translate-x-full" : "translate-x-full"

    return (
        <section
            aria-hidden={!active}
            inert={!active}
            className={cn(
                "absolute inset-0 flex flex-col",
                "motion-safe:transition-[transform,opacity] motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                active ? "translate-x-0 opacity-100" : `${inactiveClass} pointer-events-none opacity-0`,
            )}
        >
            {children}
        </section>
    )
}

export default NavigationPanel
