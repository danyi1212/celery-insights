import Alert from "@mui/material/Alert"
import AlertTitle from "@mui/material/AlertTitle"
import React from "react"

interface NotFoundAlertProps {
    error: string
}

const NotFoundAlert: React.FC<NotFoundAlertProps> = (props) => {
    return (
        <Alert severity="error">
            <AlertTitle>Not found</AlertTitle>
            {props.error}
        </Alert>
    )
}

export default NotFoundAlert
