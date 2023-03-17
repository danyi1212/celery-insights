import { Link } from "@mui/material"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import React from "react"
import {
    isRouteErrorResponse,
    Link as RouterLink,
    useRouteError,
} from "react-router-dom"

interface ErrorMessage {
    title: string
    message: string
    status?: number
}

const getErrorMessage = (error: unknown): ErrorMessage => {
    if (isRouteErrorResponse(error)) {
        return {
            title: error.statusText,
            status: error.status,
            message:
                error.error?.message ||
                "Sorry, an unexpected error has occurred",
        }
    } else if (error instanceof Error) {
        return {
            title: "Unknown Error | " + error.name,
            message: error.message,
        }
    } else {
        return {
            title: "Unknown Error",
            message: "An unknown error has occurred.",
        }
    }
}

const ErrorPage: React.FC = () => {
    const error = useRouteError()
    console.log(error)
    const message = getErrorMessage(error)
    return (
        <Box
            minHeight="100vh"
            display="flex"
            justifyContent="center"
            alignItems="center"
            flexDirection="column"
        >
            <Typography variant="h1">
                {message.status} {message.title}
            </Typography>
            <Typography variant="h5">{message.message}</Typography>
            <Link component={RouterLink} to="/">
                Back Home
            </Link>
        </Box>
    )
}

export default ErrorPage
