import ClientConnectionStatus from "@components/settings/ClientConnectionStatus"
import { Avatar, AvatarFallback } from "@components/ui/avatar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { ClientInfo } from "@services/server"
import React from "react"

interface ClientInfoItemProps {
    client: ClientInfo
}

const ClientInfoItem: React.FC<ClientInfoItemProps> = ({ client }) => {
    return (
        <li className="flex items-center gap-3 px-4 py-2">
            <Avatar>
                <AvatarFallback>
                    <ClientConnectionStatus state={client.state} isSecure={client.is_secure} />
                </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{`${client.host}:${client.port}`}</p>
                {client.user_agent?.browser ? (
                    <div className="flex justify-between gap-2 text-sm text-muted-foreground">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="truncate">
                                    {client.user_agent?.browser} {client.user_agent?.browser_version}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>Browser Info</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="truncate">
                                    {client.user_agent?.os} {client.user_agent?.os_version}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>OS Info</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="truncate">
                                    {client.user_agent?.device_brand} {client.user_agent?.device_model}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent>Device Info</TooltipContent>
                        </Tooltip>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">Unknown Agent</p>
                )}
            </div>
        </li>
    )
}
export default ClientInfoItem
