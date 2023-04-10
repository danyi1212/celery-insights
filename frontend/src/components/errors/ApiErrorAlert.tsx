import Alert from "@mui/material/Alert"
import AlertTitle from "@mui/material/AlertTitle"
import { ApiError } from "@services/server"
import React from "react"
import BadRequestAlert from "./BadRequestAlert"
import NotFoundAlert from "./NotFoundAlert"
import ValidationErrorAlert from "./ValidationErrorAlert"

interface ApiErrorAlertProps {
    error: ApiError
}

const ApiErrorAlert: React.FC<ApiErrorAlertProps> = (props) => {
    switch (props.error.status) {
        case 400:
            return <BadRequestAlert error={props.error.body} />
        case 404:
            return <NotFoundAlert error={props.error.body} />
        case 422:
            return <ValidationErrorAlert error={props.error.body} />
        default:
            console.error(props.error)
            return (
                <Alert severity="error">
                    <AlertTitle>Failed to access server</AlertTitle>
                    We are not able to contact the server, possibly due to:
                    <ol>
                        <li>The server is not running</li>
                        <li>Internal Server Error (500)</li>
                        <li>Incorrect server URL or Port</li>
                    </ol>
                </Alert>
            )
    }
}

export default ApiErrorAlert
