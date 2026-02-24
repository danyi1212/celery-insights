import { Alert, AlertDescription, AlertTitle } from "@components/ui/alert"
import { AlertCircle } from "lucide-react"
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
            <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertTitle>Unhandled Error</AlertTitle>
                <AlertDescription>We have encountered an unknown error</AlertDescription>
            </Alert>
        )
    }
}

export default ErrorAlert
