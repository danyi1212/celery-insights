import Alert from "@mui/material/Alert"
import AlertTitle from "@mui/material/AlertTitle"
import { ApiError } from "@services/server"
import React from "react"
import ApiErrorAlert from "./ApiErrorAlert"

interface ErrorAlertProps {
    error: unknown
}

const ErrorAlert: React.FC<ErrorAlertProps> = (props) => {
    if (props.error instanceof ApiError) return <ApiErrorAlert error={props.error} />
    else {
        console.error(props.error)
        return (
            <Alert severity="error">
                <AlertTitle>Unhandled Error</AlertTitle>
                We have encountered an unknown error 😳
            </Alert>
        )
    }
}

export default ErrorAlert
