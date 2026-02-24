import Panel from "@components/common/panel"
import ClientInfoItem from "@components/settings/client-info-item"
import { useClient } from "@hooks/use-client"
import { useQuery } from "@tanstack/react-query"
import React, { useCallback } from "react"

const OnlineClientsPanel: React.FC = () => {
    const client = useClient()
    const getOnlineClients = useCallback(() => client.settings.getClients(), [client])
    const { data, isLoading, error } = useQuery({
        queryKey: ["online-clients"],
        queryFn: getOnlineClients,
    })
    return (
        <Panel title="Online Clients" loading={isLoading} error={error}>
            <ul>
                {data?.map((onlineClient) => (
                    <ClientInfoItem key={`${onlineClient.host}:${onlineClient.port}`} client={onlineClient} />
                ))}
            </ul>
        </Panel>
    )
}
export default OnlineClientsPanel
