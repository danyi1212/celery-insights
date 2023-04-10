import Alert from "@mui/material/Alert"
import AlertTitle from "@mui/material/AlertTitle"
import { HTTPValidationError } from "@services/server"
import React from "react"

interface ValidationErrorAlertProps {
    error: HTTPValidationError
}

const ValidationErrorAlert: React.FC<ValidationErrorAlertProps> = (props) => {
    return (
        <Alert severity="error">
            <AlertTitle>Invalid data</AlertTitle>
            <ul>
                {props.error.detail?.map((error, index) => (
                    <li key={index}>
                        {error.loc.join(".")}: {error.msg} ({error.type})
                    </li>
                ))}
            </ul>
        </Alert>
    )
}

export default ValidationErrorAlert
