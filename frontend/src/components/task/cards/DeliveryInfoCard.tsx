import Panel from "@components/common/Panel"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemText from "@mui/material/ListItemText"
import { StateTask } from "@utils/translateServerModels"
import React from "react"

interface DeliveryInfoCardProps {
    task: StateTask
}

const EMPTY_VALUE = "None"

export const DeliveryInfoCard: React.FC<DeliveryInfoCardProps> = ({ task }) => {
    return (
        <Panel title="Delivery Info">
            <List dense>
                <ListItem>
                    <ListItemText
                        primary={task.worker || EMPTY_VALUE}
                        secondary="Worker"
                        primaryTypographyProps={{ noWrap: true }}
                    />
                </ListItem>
                <ListItem>
                    <ListItemText
                        primary={task.exchange || EMPTY_VALUE}
                        secondary="Exchange"
                        primaryTypographyProps={{ noWrap: true }}
                    />
                </ListItem>
                <ListItem>
                    <ListItemText
                        primary={task.routingKey || EMPTY_VALUE}
                        secondary="Routing Key"
                        primaryTypographyProps={{ noWrap: true }}
                    />
                </ListItem>
                <ListItem>
                    <ListItemText
                        primary={task.eta || EMPTY_VALUE}
                        secondary="ETA"
                        primaryTypographyProps={{ noWrap: true }}
                    />
                </ListItem>
                <ListItem>
                    <ListItemText
                        primary={task.expires || EMPTY_VALUE}
                        secondary="Expires"
                        primaryTypographyProps={{ noWrap: true }}
                    />
                </ListItem>
            </List>
        </Panel>
    )
}
