import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline"
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline"
import HelpOutlineIcon from "@mui/icons-material/HelpOutline"
import { CircularProgressProps, SvgIconProps } from "@mui/material"
import CircularProgress from "@mui/material/CircularProgress"
import Tooltip from "@mui/material/Tooltip"
import React, { useCallback } from "react"
import { useQuery } from "react-query"

interface VersionCheckIconProps extends SvgIconProps {
    currentVersion: string | undefined
    progressProps?: CircularProgressProps
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const isUpdateAvailable = (currentVersion: string | undefined): boolean => false

const VersionCheckIcon: React.FC<VersionCheckIconProps> = ({ currentVersion, progressProps, ...props }) => {
    const { data, isLoading, error } = useQuery(
        ["version-check", currentVersion],
        useCallback(() => isUpdateAvailable(currentVersion), [currentVersion]),
        { refetchInterval: 60 }
    )
    if (currentVersion === undefined)
        return (
            <Tooltip title="Unable to check for updates">
                <HelpOutlineIcon color="disabled" {...props} />
            </Tooltip>
        )
    else if (isLoading)
        return (
            <Tooltip title="Checking for updates">
                <CircularProgress {...progressProps} />
            </Tooltip>
        )
    else if (error)
        return (
            <Tooltip title="Error while checking for updates">
                <ErrorOutlineIcon color="error" {...props} />
            </Tooltip>
        )
    else if (data) {
        return (
            <Tooltip title="Update is available!">
                <ErrorOutlineIcon color="warning" {...props} />
            </Tooltip>
        )
    } else {
        return (
            <Tooltip title="Up to date">
                <CheckCircleOutlineIcon color="success" {...props} />
            </Tooltip>
        )
    }
}
export default VersionCheckIcon
