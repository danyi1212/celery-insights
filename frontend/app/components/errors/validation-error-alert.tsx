import { Alert, AlertDescription, AlertTitle } from "@components/ui/alert"
import { AlertCircle } from "lucide-react"
import { HTTPValidationError } from "@services/server"
import React from "react"

interface ValidationErrorAlertProps {
    error: HTTPValidationError
}

const ValidationErrorAlert: React.FC<ValidationErrorAlertProps> = (props) => {
    return (
        <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Invalid data</AlertTitle>
            <AlertDescription>
                <ul className="list-disc pl-4">
                    {props.error.detail?.map((error, index) => (
                        <li key={index}>
                            {error.loc.join(".")}: {error.msg} ({error.type})
                        </li>
                    ))}
                </ul>
            </AlertDescription>
        </Alert>
    )
}

export default ValidationErrorAlert
