import ErrorAlert from "@components/errors/ErrorAlert"
import ShortcutHint from "@components/keyboard/ShortcutHint"
import {
    commandPaletteShortcut,
    dashboardShortcut,
    explorerShortcut,
    rawEventsShortcut,
    searchShortcut,
    settingsShortcut,
} from "@components/keyboard/shortcutDefinitions"
import TaskAvatar from "@components/task/TaskAvatar"
import { ShortcutTrigger } from "@hooks/useKeyboardShortcuts"
import { useClient } from "@hooks/useClient"
import SearchIcon from "@mui/icons-material/Search"
import SettingsIcon from "@mui/icons-material/Settings"
import SpaceDashboardOutlinedIcon from "@mui/icons-material/SpaceDashboardOutlined"
import StorageIcon from "@mui/icons-material/Storage"
import ManageSearchIcon from "@mui/icons-material/ManageSearch"
import RssFeedIcon from "@mui/icons-material/RssFeed"
import Avatar from "@mui/material/Avatar"
import Box from "@mui/material/Box"
import CircularProgress from "@mui/material/CircularProgress"
import Dialog from "@mui/material/Dialog"
import DialogContent from "@mui/material/DialogContent"
import Divider from "@mui/material/Divider"
import InputBase from "@mui/material/InputBase"
import List from "@mui/material/List"
import ListItemAvatar from "@mui/material/ListItemAvatar"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemText from "@mui/material/ListItemText"
import Stack from "@mui/material/Stack"
import Typography from "@mui/material/Typography"
import { alpha } from "@mui/material/styles"
import { SearchResults } from "@services/server"
import useSettingsStore from "@stores/useSettingsStore"
import { format } from "date-fns"
import React, { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"

interface QuickAccessDialogProps {
    open: boolean
    onClose: () => void
}

interface QuickAccessAction {
    id: string
    title: string
    subtitle: string
    icon: React.ReactNode
    shortcut?: ShortcutTrigger[]
    onSelect: () => void
}

const SEARCH_DEBOUNCE_MS = 300

const QuickAccessDialog: React.FC<QuickAccessDialogProps> = ({ open, onClose }) => {
    const client = useClient()
    const navigate = useNavigate()
    const isDemo = useSettingsStore((state) => state.demo)
    const inputRef = useRef<HTMLInputElement | null>(null)
    const [query, setQuery] = useState("")
    const [results, setResults] = useState<SearchResults>({ tasks: [], workers: [] })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<unknown | null>(null)
    const [highlightedIndex, setHighlightedIndex] = useState(0)

    useEffect(() => {
        if (!open) return

        setQuery("")
        setResults({ tasks: [], workers: [] })
        setLoading(false)
        setError(null)
        setHighlightedIndex(0)

        requestAnimationFrame(() => inputRef.current?.focus())
    }, [open])

    useEffect(() => {
        if (!open) return

        const trimmedQuery = query.trim()
        if (!trimmedQuery) {
            setResults({ tasks: [], workers: [] })
            setLoading(false)
            setError(null)
            return
        }

        if (isDemo) {
            setResults({ tasks: [], workers: [] })
            setLoading(false)
            setError(null)
            return
        }

        setLoading(true)
        setError(null)
        setResults({ tasks: [], workers: [] })

        const token = window.setTimeout(() => {
            client.search
                .search(trimmedQuery)
                .then((nextResults) => setResults(nextResults))
                .catch((nextError) => setError(nextError))
                .finally(() => setLoading(false))
        }, SEARCH_DEBOUNCE_MS)

        return () => window.clearTimeout(token)
    }, [client, isDemo, open, query])

    const navigationActions = useMemo(() => {
        const actions: QuickAccessAction[] = [
            {
                id: "nav:dashboard",
                title: "Dashboard",
                subtitle: "Go to the overview page",
                icon: <SpaceDashboardOutlinedIcon fontSize="small" />,
                shortcut: dashboardShortcut,
                onSelect: () => {
                    navigate("/")
                    onClose()
                },
            },
            {
                id: "nav:explorer",
                title: "Tasks Explorer",
                subtitle: "Browse and filter tasks",
                icon: <ManageSearchIcon fontSize="small" />,
                shortcut: explorerShortcut,
                onSelect: () => {
                    navigate("/explorer")
                    onClose()
                },
            },
            {
                id: "nav:raw-events",
                title: "Live Events",
                subtitle: "Inspect the raw event stream",
                icon: <RssFeedIcon fontSize="small" />,
                shortcut: rawEventsShortcut,
                onSelect: () => {
                    navigate("/raw_events")
                    onClose()
                },
            },
            {
                id: "nav:settings",
                title: "Settings",
                subtitle: "Open app settings and server info",
                icon: <SettingsIcon fontSize="small" />,
                shortcut: settingsShortcut,
                onSelect: () => {
                    navigate("/settings")
                    onClose()
                },
            },
        ]

        const trimmedQuery = query.trim().toLowerCase()
        if (!trimmedQuery) return actions

        return actions.filter((action) =>
            [action.title, action.subtitle].some((value) => value.toLowerCase().includes(trimmedQuery)),
        )
    }, [navigate, onClose, query])

    const workerActions = useMemo<QuickAccessAction[]>(
        () =>
            results.workers.map((worker) => ({
                id: `worker:${worker.id}`,
                title: worker.hostname,
                subtitle: `Worker • PID ${worker.pid}`,
                icon: <StorageIcon fontSize="small" />,
                onSelect: () => {
                    navigate(`/workers/${worker.id}`)
                    onClose()
                },
            })),
        [navigate, onClose, results.workers],
    )

    const taskActions = useMemo<QuickAccessAction[]>(
        () =>
            results.tasks.map((task) => ({
                id: `task:${task.id}`,
                title: task.type || "Unknown task",
                subtitle: `Task • Sent at ${format(task.sent_at, "HH:mm:ss")}`,
                icon: <TaskAvatar taskId={task.id} type={task.type} status={task.state} />,
                onSelect: () => {
                    navigate(`/tasks/${task.id}`)
                    onClose()
                },
            })),
        [navigate, onClose, results.tasks],
    )

    const actions = useMemo(
        () => [...navigationActions, ...workerActions, ...taskActions],
        [navigationActions, taskActions, workerActions],
    )

    useEffect(() => {
        if (actions.length === 0) {
            setHighlightedIndex(0)
            return
        }

        setHighlightedIndex((current) => Math.min(current, actions.length - 1))
    }, [actions])

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "ArrowDown") {
            event.preventDefault()
            setHighlightedIndex((current) => (actions.length === 0 ? 0 : (current + 1) % actions.length))
            return
        }

        if (event.key === "ArrowUp") {
            event.preventDefault()
            setHighlightedIndex((current) =>
                actions.length === 0 ? 0 : (current - 1 + actions.length) % actions.length,
            )
            return
        }

        if (event.key === "Enter" && actions[highlightedIndex]) {
            event.preventDefault()
            actions[highlightedIndex].onSelect()
        }
    }

    const showEmptyState =
        !loading && !error && navigationActions.length === 0 && workerActions.length === 0 && taskActions.length === 0

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogContent sx={{ p: 0 }}>
                <Stack>
                    <Stack direction="row" alignItems="center" spacing={1.5} px={2.5} py={2}>
                        <SearchIcon color="action" />
                        <InputBase
                            inputRef={inputRef}
                            fullWidth
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Search tasks, workers, or pages"
                            inputProps={{ "aria-label": "Quick access search" }}
                            sx={{ fontSize: "1rem" }}
                        />
                        <Stack direction="row" spacing={0.75} alignItems="center" flexShrink={0}>
                            <ShortcutHint sequence={searchShortcut} />
                            <Typography variant="caption" color="text.secondary">
                                or
                            </Typography>
                            <ShortcutHint sequence={commandPaletteShortcut} />
                        </Stack>
                    </Stack>
                    <Divider />

                    <SectionLabel label="Navigation" />
                    <List disablePadding>
                        {navigationActions.map((action, index) => (
                            <QuickAccessListItem
                                key={action.id}
                                action={action}
                                selected={highlightedIndex === index}
                                onMouseEnter={() => setHighlightedIndex(index)}
                            />
                        ))}
                    </List>

                    {query.trim() ? (
                        <>
                            <SectionLabel label="Search Results" />
                            {isDemo ? (
                                <Typography color="text.secondary" px={2.5} py={2}>
                                    Search results are unavailable in Demo Mode. Navigation is still available here.
                                </Typography>
                            ) : null}
                            {loading ? (
                                <Box display="flex" justifyContent="center" py={3}>
                                    <CircularProgress size={24} />
                                </Box>
                            ) : null}
                            {error ? <ErrorAlert error={error} /> : null}
                            {!loading && !error && !isDemo ? (
                                <List disablePadding>
                                    {[...workerActions, ...taskActions].map((action, index) => (
                                        <QuickAccessListItem
                                            key={action.id}
                                            action={action}
                                            selected={highlightedIndex === navigationActions.length + index}
                                            onMouseEnter={() => setHighlightedIndex(navigationActions.length + index)}
                                        />
                                    ))}
                                </List>
                            ) : null}
                        </>
                    ) : null}

                    {showEmptyState ? (
                        <Typography color="text.secondary" px={2.5} py={3}>
                            No pages, workers, or tasks matched your search.
                        </Typography>
                    ) : null}
                </Stack>
            </DialogContent>
        </Dialog>
    )
}

const SectionLabel: React.FC<{ label: string }> = ({ label }) => (
    <Typography variant="overline" color="text.secondary" px={2.5} pt={1.5} pb={0.75}>
        {label}
    </Typography>
)

interface QuickAccessListItemProps {
    action: QuickAccessAction
    selected: boolean
    onMouseEnter: () => void
}

const QuickAccessListItem: React.FC<QuickAccessListItemProps> = ({ action, selected, onMouseEnter }) => (
    <ListItemButton
        selected={selected}
        onClick={action.onSelect}
        onMouseEnter={onMouseEnter}
        sx={{ px: 2.5, py: 1.25 }}
    >
        <ListItemAvatar>
            {typeof action.icon === "string" ? (
                <Avatar>{action.icon}</Avatar>
            ) : React.isValidElement(action.icon) && action.id.startsWith("task:") ? (
                action.icon
            ) : (
                <Avatar
                    sx={{
                        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                        color: "primary.main",
                    }}
                >
                    {action.icon}
                </Avatar>
            )}
        </ListItemAvatar>
        <ListItemText primary={action.title} secondary={action.subtitle} />
        {action.shortcut ? <ShortcutHint sequence={action.shortcut} /> : null}
    </ListItemButton>
)

export default QuickAccessDialog
