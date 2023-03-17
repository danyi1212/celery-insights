import Typography from "@mui/material/Typography"
import React from "react"
import { Outlet } from "react-router-dom"

const RootLayout: React.FC = () => {
    return (
        <div>
            <Typography variant="h1" align="center">
                Celery Soup
            </Typography>
            <Outlet />
        </div>
    )
}

export default RootLayout
