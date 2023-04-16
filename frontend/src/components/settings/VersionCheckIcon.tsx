import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline"
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline"
import HelpOutlineIcon from "@mui/icons-material/HelpOutline"
import CircularProgress from "@mui/material/CircularProgress"
import Tooltip from "@mui/material/Tooltip"
import React, { useCallback } from "react"
import { useQuery } from "react-query"

interface VersionCheckIconProps {
    currentVersion: string | undefined
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const isUpdateAvailable = (currentVersion: string | undefined): boolean => false

const VersionCheckIcon: React.FC<VersionCheckIconProps> = ({ currentVersion }) => {
    const { data, isLoading, error } = useQuery(
        ["version-check", currentVersion],
        useCallback(() => isUpdateAvailable(currentVersion), [currentVersion]),
        { refetchInterval: 60 }
    )
    if (currentVersion === undefined)
        return (
            <Tooltip title="Unable to check for updates">
                <HelpOutlineIcon fontSize="small" color="disabled" sx={{ mx: 1 }} />
            </Tooltip>
        )
    else if (isLoading)
        return (
            <Tooltip title="Checking for updates">
                <CircularProgress size={"1rem"} sx={{ mx: 1 }} />
            </Tooltip>
        )
    else if (error)
        return (
            <Tooltip title="Error while checking for updates">
                <ErrorOutlineIcon fontSize="small" color="error" sx={{ mx: 1 }} />
            </Tooltip>
        )
    else if (data) {
        return (
            <Tooltip title="Update is available!">
                <ErrorOutlineIcon fontSize="small" color="warning" sx={{ mx: 1 }} />
            </Tooltip>
        )
    } else {
        return (
            <Tooltip title="Up to date">
                <CheckCircleOutlineIcon fontSize="small" color="success" sx={{ mx: 1 }} />
            </Tooltip>
        )
    }
}
export default VersionCheckIcon
