import ExceptionAlert from "@components/task/alerts/ExceptionAlert"
import Box from "@mui/material/Box"
import { useStateStore } from "@stores/useStateStore"
import React, { useMemo } from "react"

const ExceptionsSummary: React.FC = () => {
    const tasks = useStateStore((store) => store.tasks)
    const errors = useMemo(
        () =>
            tasks
                .map((task) => task)
                .filter((task) => task.exception)
                .reduce((acc, { exception, traceback }) => acc.set(exception, traceback), new Map()),
        [tasks]
    )
    return (
        <Box m={3}>
            {Array.from(errors.entries()).map(([exception, traceback]) => (
                <ExceptionAlert key={exception} exception={exception} traceback={traceback} sx={{ my: 2 }} />
            ))}
        </Box>
    )
}
export default ExceptionsSummary
