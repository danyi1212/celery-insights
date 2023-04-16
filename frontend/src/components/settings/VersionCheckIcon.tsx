import { useGithubLatestRelease } from "@hooks/useGithubLatestRelease"
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline"
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline"
import HelpOutlineIcon from "@mui/icons-material/HelpOutline"
import { CircularProgressProps, SvgIconProps } from "@mui/material"
import CircularProgress from "@mui/material/CircularProgress"
import Tooltip from "@mui/material/Tooltip"
import React, { useMemo } from "react"
import semver from "semver"

interface VersionCheckIconProps extends SvgIconProps {
    currentVersion: string | undefined
    progressProps?: CircularProgressProps
}

const VersionCheckIcon: React.FC<VersionCheckIconProps> = ({ currentVersion, progressProps, ...props }) => {
    const { data, isLoading, error } = useGithubLatestRelease()
    const isUpdateAvailable = useMemo(
        () => data?.data.tag_name && currentVersion && semver.gt(data.data.tag_name, currentVersion),
        [data?.data.tag_name, currentVersion]
    )
    if (isLoading)
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
    if (currentVersion === undefined || data?.data.tag_name === undefined)
        return (
            <Tooltip title="Unable to check for updates">
                <HelpOutlineIcon color="disabled" {...props} />
            </Tooltip>
        )
    else if (isUpdateAvailable) {
        return (
            <Tooltip title={`Update is available! ${currentVersion} => ${data.data.tag_name}`}>
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
