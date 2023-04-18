import NotificationsOffIcon from "@mui/icons-material/NotificationsOff"
import Badge from "@mui/material/Badge"
import IconButton from "@mui/material/IconButton"
import Tooltip from "@mui/material/Tooltip"
import React from "react"

const NotificationBadge: React.FC = () => {
    return (
        <Tooltip title="Coming soon!" arrow>
            <IconButton size="large">
                <Badge badgeContent={0} color="error">
                    <NotificationsOffIcon />
                </Badge>
            </IconButton>
        </Tooltip>
    )
}
export default NotificationBadge
