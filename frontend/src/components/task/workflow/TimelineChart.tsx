import { useNow } from "@hooks/useNow"
import { Theme, useTheme } from "@mui/material"
import { StateTask } from "@utils/translateServerModels"
import { ApexOptions } from "apexcharts"
import { formatDistanceStrict } from "date-fns"
import React, { useMemo } from "react"
import Chart from "react-apexcharts"

const getTimestamp = (date: Date) => date.getTime()

const getSeries = (tasks: StateTask[], now: Date): ApexAxisChartSeries => {
    const data = tasks.map((task) => ({
        x: task.id,
        y: [getTimestamp(task.startedAt || now), getTimestamp(task.succeededAt || task.failedAt || now)],
        goals: [{ value: getTimestamp(task.sentAt) }],
    }))
    return [
        {
            data,
        },
    ]
}

const REALTIME_INTERVAL = 100
const getOptions = (theme: Theme): ApexOptions => ({
    chart: {
        background: theme.palette.background.paper,
        foreColor: theme.palette.text.primary,
        fontFamily: theme.typography.fontFamily,
        animations: {
            enabled: true,
            easing: "linear",
            dynamicAnimation: {
                speed: REALTIME_INTERVAL,
            },
        },
    },
    plotOptions: {
        bar: {
            horizontal: true,
            distributed: true,
            dataLabels: {
                hideOverflowingLabels: true,
            },
        },
    },
    dataLabels: {
        enabled: true,
        formatter: (value) => {
            const [first, second] = value as [number, number]
            return formatDistanceStrict(first, second, { unit: "second" })
        },
    },
    xaxis: {
        type: "datetime",
        labels: {
            datetimeUTC: false,
        },
    },
    yaxis: {
        labels: {
            formatter: (value) => value.toString().slice(0, 5),
        },
    },
})

interface TimelineChartProps {
    tasks: StateTask[]
    rootTaskId: string
    currentTaskId?: string
}

const TimelineChart: React.FC<TimelineChartProps> = ({ tasks }) => {
    const theme = useTheme()
    const sortedTasks = useMemo(() => tasks.sort((a, b) => (a.sentAt > b.sentAt ? 1 : -1)), [tasks])
    const isRealtime = useMemo(
        () => tasks.find((task) => (task.succeededAt || task.failedAt) === undefined) !== undefined,
        [tasks]
    )
    const now = useNow(isRealtime ? REALTIME_INTERVAL : undefined)
    const series = useMemo(() => getSeries(sortedTasks, now), [sortedTasks, now])
    const options: ApexOptions = useMemo(() => getOptions(theme), [theme])
    return <Chart type="rangeBar" options={options} series={series} height="100%" width="100%" />
}

export default TimelineChart
