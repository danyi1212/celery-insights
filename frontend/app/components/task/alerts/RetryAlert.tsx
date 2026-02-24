import { Alert, AlertDescription, AlertTitle } from "@components/ui/alert"
import { cn } from "@lib/utils"
import { AlertCircle, Info } from "lucide-react"
import React from "react"

interface RetryAlertProps extends React.ComponentProps<"div"> {
    retries?: number
}

const RetryAlert: React.FC<RetryAlertProps> = ({ retries, className, ...props }) => {
    if (!retries || retries === 0) {
        return null
    }

    if (retries === 1) {
        return (
            <Alert className={cn(className)} {...props}>
                <Info className="size-4" />
                <AlertTitle>Retry Attempt #1</AlertTitle>
                <AlertDescription>The task is being retried.</AlertDescription>
            </Alert>
        )
    }

    return (
        <Alert variant={retries >= 10 ? "destructive" : "default"} className={cn(className)} {...props}>
            <AlertCircle className="size-4" />
            <AlertTitle>Retry Attempt #{retries}</AlertTitle>
            <AlertDescription>The task has been tried {retries} times.</AlertDescription>
        </Alert>
    )
}

export default RetryAlert
