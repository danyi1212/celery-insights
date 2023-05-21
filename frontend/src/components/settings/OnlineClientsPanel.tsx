import Panel from "@components/common/Panel"
import ClientInfoItem from "@components/settings/ClientInfoItem"
import { useClient } from "@hooks/useClient"
import List from "@mui/material/List"
import React, { useCallback } from "react"
import { useQuery } from "react-query"

const OnlineClientsPanel: React.FC = () => {
    const client = useClient()
    const getOnlineClients = useCallback(() => client.settings.getClients(), [client])
    const { data, isLoading, error } = useQuery("online-clients", getOnlineClients)
    return (
        <Panel title="Online Clients" loading={isLoading} error={error}>
            <List>
                {data?.map((onlineClient) => (
                    <ClientInfoItem key={`${onlineClient.host}:${onlineClient.port}`} client={onlineClient} />
                ))}
            </List>
        </Panel>
    )
}
export default OnlineClientsPanel
