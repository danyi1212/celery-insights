import NotificationsIcon from "@mui/icons-material/Notifications"
import Badge from "@mui/material/Badge"
import IconButton from "@mui/material/IconButton"
import React from "react"

const NotificationBudge: React.FC = () => (
    <IconButton size="large">
        <Badge badgeContent={17} color="error">
            <NotificationsIcon />
        </Badge>
    </IconButton>
)
export default NotificationBudge
