import create from "zustand"

type NotificationType = "error" | "info" | "success"

export interface Notification {
    id: number
    timestamp: Date
    seen: boolean
    icon?: string
    link?: string
    message: string
    type: NotificationType
}

interface NotificationStore {
    notifications: Notification[]
    enabled: boolean
    limit: number
}

export const useNotificationStore = create<NotificationStore>(() => ({
    notifications: [],
    enabled: Notification.permission === "granted",
    limit: 30,
}))

export const addNotification = (notification: Omit<Notification, "id" | "timestamp" | "seen">) => {
    const enabled = useNotificationStore.getState().enabled

    if (enabled && Notification.permission === "granted") {
        const notificationOptions = {
            body: notification.message,
            icon: notification.icon,
            data: {
                url: notification.link,
            },
        }

        new Notification(notification.type, notificationOptions)
        useNotificationStore.setState((state) => ({
            notifications: [
                {
                    id: state.notifications.length + 1,
                    timestamp: new Date(),
                    seen: false,
                    ...notification,
                },
                ...state.notifications.slice(0, state.limit - 1),
            ],
        }))
    }
}

export const toggleNotifications = async () => {
    const enabled = useNotificationStore.getState().enabled

    if (enabled) {
        useNotificationStore.setState({ enabled: false })
    } else {
        if (Notification.permission === "granted") {
            useNotificationStore.setState({ enabled: true })
        } else if (Notification.permission !== "denied") {
            const permission = await Notification.requestPermission()
            if (permission === "granted") {
                useNotificationStore.setState({ enabled: true })
            }
        }
    }
}

export const clearNotifications = () => useNotificationStore.setState({ notifications: [] })

export const setNotificationSeen = (notificationId: number) =>
    useNotificationStore.setState((state) => {
        const notifications = state.notifications.map((notification) => {
            if (notification.id === notificationId) {
                return { ...notification, seen: true }
            } else {
                return notification
            }
        })
        return { notifications, enabled: state.enabled }
    })
