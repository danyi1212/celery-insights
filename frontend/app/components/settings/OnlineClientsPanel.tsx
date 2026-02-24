import Panel from "@components/common/Panel"
import ClientInfoItem from "@components/settings/ClientInfoItem"
import { useClient } from "@hooks/useClient"
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
