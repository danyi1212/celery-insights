import ExceptionAlert from "@components/task/alerts/ExceptionAlert"
import Avatar from "@mui/material/Avatar"
import Box from "@mui/material/Box"
import Chip from "@mui/material/Chip"
import Collapse from "@mui/material/Collapse"
import Tooltip from "@mui/material/Tooltip"
import { useStateStore } from "@stores/useStateStore"
import React, { useMemo, useState } from "react"

const ExceptionsSummary: React.FC = () => {
    const tasks = useStateStore((store) => store.tasks)
    const errorsMap = useMemo(() => {
        const map = new Map<string, { count: number; traceback: string | undefined }>()
        for (const task of tasks) {
            if (task.exception) {
                const entry = map.get(task.exception)
                if (entry) {
                    map.set(task.exception, { count: entry.count + 1, traceback: task.traceback })
                } else {
                    map.set(task.exception, { count: 1, traceback: task.traceback })
                }
            }
        }
        return map
    }, [tasks])
    const [selectedError, setSelectedError] = useState<string | null>(null)
    const errorMessages = useMemo(() => Array.from(errorsMap.keys()), [errorsMap])

    return (
        <Box>
            <Box display="flex" flexWrap="wrap" mt={3}>
                {errorMessages.map((error) => (
                    <Tooltip key={error} title="Click to show error">
                        <Chip
                            label={error}
                            onClick={() => setSelectedError(selectedError === error ? null : error)}
                            avatar={
                                <Avatar
                                    sx={{
                                        backgroundColor: (theme) =>
                                            theme.palette.mode == "dark"
                                                ? theme.palette.error.dark
                                                : theme.palette.error.light,
                                    }}
                                >
                                    {errorsMap.get(error)?.count || 0}
                                </Avatar>
                            }
                            color="error"
                            variant={selectedError === error ? "filled" : "outlined"}
                            sx={{ mx: 1, maxWidth: "300px" }}
                        />
                    </Tooltip>
                ))}
            </Box>
            <Collapse in={Boolean(selectedError)} unmountOnExit>
                <ExceptionAlert
                    exception={selectedError || ""}
                    traceback={errorsMap.get(selectedError || "")?.traceback}
                    sx={{ my: 2 }}
                />
            </Collapse>
        </Box>
    )
}

export default ExceptionsSummary
