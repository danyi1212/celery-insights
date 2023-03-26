import { useNow } from "@hooks/useNow"
import { Theme, useTheme } from "@mui/material"
import { StateTask } from "@utils/translateServerModels"
import { ApexOptions } from "apexcharts"
import React, { useMemo } from "react"
import Chart from "react-apexcharts"

const getTimestamp = (date: Date) => date.getTime()

const getSeries = (tasks: StateTask[], now: Date): ApexAxisChartSeries => {
    const data = tasks.map((task) => ({
        x: task.id,
        y: [getTimestamp(task.startedAt || now), getTimestamp(task.succeededAt || task.failedAt || now)],
        name: task.type,
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
        toolbar: {
            autoSelected: "pan",
        },
    },
    tooltip: {
        enabled: true,
        x: {
            format: "HH:mm:ss",
        },
    },
    theme: {
        mode: theme.palette.mode,
        palette: "palette4",
    },
    plotOptions: {
        bar: {
            horizontal: true,
            distributed: true,
            borderRadius: 3,
            dataLabels: {
                hideOverflowingLabels: true,
            },
        },
    },
    dataLabels: {
        enabled: true,
        formatter: (value) => {
            const [first, second] = value as [number, number]
            const duration = second - first
            const minutes = Math.floor(duration / (60 * 1000))
            const seconds = Math.floor(duration / 1000)
            const ms = duration % 1000
            if (minutes) return `${minutes}min, ${seconds}s, ${ms}ms`
            else if (seconds) return `${seconds}.${ms} seconds`
            else return `${ms}ms`
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
            show: false,
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
