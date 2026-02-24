import { Alert, AlertDescription, AlertTitle } from "@components/ui/alert"
import { AlertCircle } from "lucide-react"
import React from "react"

interface BadRequestAlertProps {
    error: string
}

const BadRequestAlert: React.FC<BadRequestAlertProps> = (props) => {
    return (
        <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Bad Request</AlertTitle>
            <AlertDescription>{props.error}</AlertDescription>
        </Alert>
    )
}

export default BadRequestAlert
