import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import { useGithubLatestRelease } from "@hooks/use-github-latest-release"
import { AlertCircle, CheckCircle, HelpCircle, Loader2 } from "lucide-react"
import React, { useMemo } from "react"
import semver from "semver"

interface VersionCheckIconProps {
    currentVersion: string | undefined
}

const VersionCheckIcon: React.FC<VersionCheckIconProps> = ({ currentVersion }) => {
    const { data, isLoading, error } = useGithubLatestRelease()
    const isUpdateAvailable = useMemo(
        () => data?.tag_name && currentVersion && semver.gt(data.tag_name, currentVersion),
        [data?.tag_name, currentVersion],
    )
    if (isLoading)
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <Loader2 className="mx-1 size-4 animate-spin text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>Checking for updates</TooltipContent>
            </Tooltip>
        )
    else if (error)
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <AlertCircle className="mx-1 size-4 text-destructive" />
                </TooltipTrigger>
                <TooltipContent>Error while checking for updates</TooltipContent>
            </Tooltip>
        )
    if (currentVersion === undefined || data?.tag_name === undefined)
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <HelpCircle className="mx-1 size-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>Unable to check for updates</TooltipContent>
            </Tooltip>
        )
    else if (isUpdateAvailable) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <AlertCircle className="mx-1 size-4 text-status-warning" />
                </TooltipTrigger>
                <TooltipContent>{`Update is available! ${currentVersion} => ${data.tag_name}`}</TooltipContent>
            </Tooltip>
        )
    } else {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <CheckCircle className="mx-1 size-4 text-status-success" />
                </TooltipTrigger>
                <TooltipContent>Up to date</TooltipContent>
            </Tooltip>
        )
    }
}
export default VersionCheckIcon
