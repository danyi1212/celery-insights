import ClientConnectionStatus from "@components/settings/ClientConnectionStatus"
import Avatar from "@mui/material/Avatar"
import Grid from "@mui/material/Grid"
import ListItem from "@mui/material/ListItem"
import ListItemAvatar from "@mui/material/ListItemAvatar"
import ListItemText from "@mui/material/ListItemText"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import { ClientInfo } from "@services/server"
import React from "react"

interface ClientInfoItemProps {
    client: ClientInfo
}

const ClientInfoItem: React.FC<ClientInfoItemProps> = ({ client }) => {
    return (
        <ListItem>
            <ListItemAvatar>
                <Avatar>
                    <ClientConnectionStatus state={client.state} isSecure={client.is_secure} />
                </Avatar>
            </ListItemAvatar>
            <ListItemText
                primary={`${client.host}:${client.port}`}
                secondary={
                    client.browser ? (
                        <Grid container justifyContent="space-between" width="100%">
                            <Grid item>
                                <Tooltip title="Browser Info" arrow describeChild>
                                    <Typography>
                                        {client.browser} {client.browser_version}
                                    </Typography>
                                </Tooltip>
                            </Grid>
                            <Grid item>
                                <Tooltip title="OS Info" arrow describeChild>
                                    <Typography>
                                        {client.os} {client.os_version}
                                    </Typography>
                                </Tooltip>
                            </Grid>
                            <Grid item>
                                <Tooltip title="Device Info" arrow describeChild>
                                    <Typography>
                                        {client.device_brand} {client.device_model}
                                    </Typography>
                                </Tooltip>
                            </Grid>
                        </Grid>
                    ) : (
                        "Unknown Agent"
                    )
                }
            />
        </ListItem>
    )
}
export default ClientInfoItem
