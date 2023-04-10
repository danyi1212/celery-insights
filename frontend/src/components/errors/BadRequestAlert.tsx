import Alert from "@mui/material/Alert"
import AlertTitle from "@mui/material/AlertTitle"
import React from "react"

interface BadRequestAlertProps {
    error: string
}

const BadRequestAlert: React.FC<BadRequestAlertProps> = (props) => {
    return (
        <Alert severity="error">
            <AlertTitle>Bad Request</AlertTitle>
            {props.error}
        </Alert>
    )
}

export default BadRequestAlert
