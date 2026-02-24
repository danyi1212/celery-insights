import { Button } from "@components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { BellOff } from "lucide-react"
import React from "react"

const NotificationBadge: React.FC = () => {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Button variant="ghost" size="icon">
                    <BellOff className="size-5" />
                </Button>
            </TooltipTrigger>
            <TooltipContent>Coming soon!</TooltipContent>
        </Tooltip>
    )
}
export default NotificationBadge
