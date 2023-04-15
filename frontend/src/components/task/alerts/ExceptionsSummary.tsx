import ExceptionAlert from "@components/task/alerts/ExceptionAlert"
import Box from "@mui/material/Box"
import { useStateStore } from "@stores/useStateStore"
import React from "react"

const ExceptionsSummary: React.FC = () => {
    const errors: Map<string, string | undefined> = useStateStore((state) =>
        state.tasks
            .map((task) => task)
            .filter((task) => task.exception)
            .reduce((acc, { exception, traceback }) => acc.set(exception, traceback), new Map())
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
