import Panel from "@components/common/Panel"
import ClientInfoItem from "@components/settings/ClientInfoItem"
import List from "@mui/material/List"
import { ServerClient } from "@services/server"
import React from "react"
import { useQuery } from "react-query"

const OnlineClientsPanel: React.FC = () => {
    const { data, isLoading, error } = useQuery("online-clients", () => new ServerClient().settings.getClients())
    return (
        <Panel title="Online Clients" loading={isLoading} error={error}>
            <List>
                {data?.map((client) => (
                    <ClientInfoItem key={`${client.host}:${client.port}`} client={client} />
                ))}
            </List>
        </Panel>
    )
}
export default OnlineClientsPanel
