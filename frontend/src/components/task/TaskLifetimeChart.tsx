import { useNow } from "@hooks/useNow"
import { Theme, useTheme } from "@mui/material"
import { formatDurationExact } from "@utils/FormatDurationExact"
import { StateTask } from "@utils/translateServerModels"
import { ApexOptions } from "apexcharts"
import React, { useMemo } from "react"
import Chart from "react-apexcharts"

interface TaskLifetimeChart {
    task: StateTask
}

const REALTIME_INTERVAL = 10
const getOptions = (theme: Theme): ApexOptions => ({
    chart: {
        background: theme.palette.background.paper,
        foreColor: theme.palette.text.primary,
        fontFamily: theme.typography.fontFamily,
        parentHeightOffset: 0,
        animations: {
            enabled: true,
            easing: "linear",
            dynamicAnimation: {
                speed: REALTIME_INTERVAL,
            },
        },
        toolbar: {
            show: false,
        },
    },
    grid: {
        show: false,
    },
    plotOptions: {
        bar: {
            horizontal: true,
            rangeBarGroupRows: true,
            columnWidth: "100%",
            barHeight: "100%",
            dataLabels: {
                hideOverflowingLabels: true,
            },
        },
    },
    colors: [theme.palette.grey.A400, theme.palette.info.main, theme.palette.success.main],
    fill: {
        type: "solid",
    },
    dataLabels: {
        enabled: true,
        formatter: (value) => {
            const [first, second] = value as [number, number]
            const duration = second - first
            return formatDurationExact(duration)
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
    legend: {
        show: true,
        position: "right",
    },
})

const getTimestamp = (date: Date) => date.getTime()
const getFinishedAt = (task: StateTask): Date | undefined =>
    task.succeededAt || task.failedAt || task.retriedAt || task.rejectedAt || task.revokedAt

const getSeries = (task: StateTask, now: Date): ApexAxisChartSeries => [
    {
        name: "Waiting in Queue",
        data: [{ y: [getTimestamp(task.sentAt), getTimestamp(task.receivedAt || now)], x: task.id }],
    },
    {
        name: "Waiting in Worker",
        data: [{ y: [getTimestamp(task.receivedAt || now), getTimestamp(task.startedAt || now)], x: task.id }],
    },
    {
        name: "Running",
        data: [{ y: [getTimestamp(task.startedAt || now), getTimestamp(getFinishedAt(task) || now)], x: task.id }],
    },
]

const TaskLifetimeChart: React.FC<TaskLifetimeChart> = ({ task }) => {
    const theme = useTheme()
    const isRealtime = useMemo(
        () => task.receivedAt === undefined || task.startedAt === undefined || getFinishedAt(task) === undefined,
        [task]
    )
    const now = useNow(isRealtime ? REALTIME_INTERVAL : 0)
    const options = useMemo(() => getOptions(theme), [theme])
    const series = useMemo(() => getSeries(task, now), [task, now])

    return <Chart type="rangeBar" options={options} series={series} width="100%" height="120px" />
}

export default TaskLifetimeChart
