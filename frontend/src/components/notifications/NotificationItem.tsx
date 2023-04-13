import ListItem from "@mui/material/ListItem"
import ListItemText from "@mui/material/ListItemText"
import { Notification, setNotificationSeen } from "@stores/useNotifications"
import React, { useEffect } from "react"

interface NotificationItemProps {
    notification: Notification
}

const NotificationItem: React.FC<NotificationItemProps> = ({ notification }) => {
    useEffect(() => {
        // Automatically mark notification as seen after 5 seconds
        const token = setTimeout(() => {
            if (!notification.seen) {
                setNotificationSeen(notification.id)
            }
        }, 1000)
        return () => clearTimeout(token)
    }, [notification.id, notification.seen])
    return (
        <ListItem>
            <ListItemText primary={notification.type} secondary={notification.message} />
        </ListItem>
    )
}
export default NotificationItem
