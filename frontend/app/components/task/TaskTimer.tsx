import TimeSince from "@components/common/DistanceTimer"
import { useNow } from "@hooks/useNow"
import { SvgIconComponent } from "@mui/icons-material" // eslint-disable-line mui-path-imports/mui-path-imports
import AlarmIcon from "@mui/icons-material/Alarm"
import ScheduleIcon from "@mui/icons-material/Schedule"
import { TypographyProps } from "@mui/material"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import { StateTask } from "@utils/translateServerModels"
import { differenceInMinutes, format } from "date-fns"
import React, { useMemo } from "react"

interface TaskTimerProps extends Omit<TypographyProps, "color"> {
    task: StateTask
}

interface TimerInfo {
    tooltip: string
    icon: SvgIconComponent
    color: TypographyProps["color"]
    date: Date
}

function getTimerInfo(etaDate: Date | null, expireDate: Date | null, now: Date): TimerInfo | null {
    if (etaDate && etaDate > now) {
        return {
            tooltip: `Starting at ${format(etaDate, "Ppp")}`,
            icon: ScheduleIcon,
            color: (theme) => theme.palette.secondary.main,
            date: etaDate,
        }
    } else if (expireDate) {
        if (expireDate > now) {
            return {
                tooltip: `Expires at ${format(expireDate, "Ppp")}`,
                icon: AlarmIcon,
                color:
                    differenceInMinutes(expireDate, now) < 5
                        ? (theme) => theme.palette.error.main
                        : (theme) => theme.palette.warning.main,
                date: expireDate,
            }
        } else {
            return {
                tooltip: `Expired at ${format(expireDate, "Ppp")}`,
                icon: AlarmIcon,
                color: (theme) => theme.palette.warning.main,
                date: expireDate,
            }
        }
    } else {
        return null
    }
}

const TaskTimer: React.FC<TaskTimerProps> = ({ task, ...props }) => {
    const etaDate = useMemo(() => (task.eta ? new Date(task.eta) : null), [task.eta])
    const expireDate = useMemo(() => (task.expires ? new Date(task.expires) : null), [task.expires])
    const now = useNow(etaDate && expireDate ? 1000 : undefined)
    const info = useMemo(() => getTimerInfo(etaDate, expireDate, now), [etaDate, expireDate, now])

    return info ? (
        <Tooltip title={info.tooltip}>
            <Typography component="span" {...props} color={info.color}>
                <info.icon sx={{ mx: 1, verticalAlign: "middle" }} />
                <TimeSince time={info.date} addSuffix />
            </Typography>
        </Tooltip>
    ) : null
}

export default TaskTimer
