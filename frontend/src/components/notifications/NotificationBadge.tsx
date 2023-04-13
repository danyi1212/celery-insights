import NotificationItem from "@components/notifications/NotificationItem"
import ClearAllIcon from "@mui/icons-material/ClearAll"
import NotificationsIcon from "@mui/icons-material/Notifications"
import NotificationsOffIcon from "@mui/icons-material/NotificationsOff"
import Badge from "@mui/material/Badge"
import IconButton from "@mui/material/IconButton"
import List from "@mui/material/List"
import ListItem from "@mui/material/ListItem"
import ListItemSecondaryAction from "@mui/material/ListItemSecondaryAction"
import ListItemText from "@mui/material/ListItemText"
import Popover from "@mui/material/Popover"
import Switch from "@mui/material/Switch"
import Tooltip from "@mui/material/Tooltip"
import {
    addNotification,
    clearNotifications,
    toggleNotifications,
    useNotificationStore,
} from "@stores/useNotifications"
import React, { useEffect, useMemo } from "react"

const NotificationBadge: React.FC = () => {
    const [anchorEl, setAnchorEl] = React.useState<HTMLButtonElement | null>(null)

    const notifications = useNotificationStore((state) => state.notifications)
    const unseenNotifications = useMemo(
        () => notifications.filter((notification) => !notification.seen),
        [notifications]
    )
    const enabled = useNotificationStore((state) => state.enabled)
    const id = anchorEl ? "notification-popover" : undefined

    useEffect(() => {
        // Create fake notifications when dropdown is open
        if (anchorEl) {
            const token = setInterval(
                () =>
                    addNotification({
                        type: "info",
                        message: "Hello world!",
                    }),
                5 * 1000
            )
            return () => clearInterval(token)
        }
    }, [anchorEl])

    return (
        <>
            <IconButton size="large" aria-describedby={id} onClick={(event) => setAnchorEl(event.currentTarget)}>
                <Badge badgeContent={unseenNotifications.length} color="error">
                    {enabled ? <NotificationsIcon /> : <NotificationsOffIcon />}
                </Badge>
            </IconButton>
            <Popover
                id={id}
                open={Boolean(anchorEl)}
                anchorEl={anchorEl}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                onClose={() => setAnchorEl(null)}
            >
                <List
                    sx={{ width: "450px", maxHeight: "70vh", overflowY: "scroll" }}
                    subheader={
                        <ListItem>
                            <ListItemText primary="Notifications"></ListItemText>
                            <ListItemSecondaryAction>
                                <Tooltip title={enabled ? "Disable notifications" : "Enable notifications"} arrow>
                                    <Switch checked={enabled} onChange={async () => await toggleNotifications()} />
                                </Tooltip>
                                <Tooltip title="Clear all" arrow>
                                    <IconButton onClick={() => clearNotifications()}>
                                        <ClearAllIcon />
                                    </IconButton>
                                </Tooltip>
                            </ListItemSecondaryAction>
                        </ListItem>
                    }
                >
                    {notifications.map((notification) => (
                        <NotificationItem key={notification.id} notification={notification} />
                    ))}
                    {notifications.length === 0 && (
                        <ListItem>
                            <ListItemText primary="No new notifications" primaryTypographyProps={{ align: "center" }} />
                        </ListItem>
                    )}
                </List>
            </Popover>
        </>
    )
}
export default NotificationBadge
