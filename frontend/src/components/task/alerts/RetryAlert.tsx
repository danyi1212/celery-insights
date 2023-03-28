import Alert, { AlertProps } from "@mui/material/Alert"
import AlertTitle from "@mui/material/AlertTitle"
import React from "react"

interface RetryAlertProps extends AlertProps {
    retries?: number
}

const RetryAlert: React.FC<RetryAlertProps> = ({ retries, ...props }) => {
    if (!retries || retries === 0) {
        return null
    }

    if (retries === 1) {
        return (
            <Alert severity="info" {...props}>
                <AlertTitle>Retry Attempt #1</AlertTitle>
                The task is being retried.
            </Alert>
        )
    }

    return (
        <Alert severity={retries < 10 ? "warning" : "error"} {...props}>
            <AlertTitle>Retry Attempt #{retries}</AlertTitle>
            The task has been tried {retries} times.
        </Alert>
    )
}

export default RetryAlert
