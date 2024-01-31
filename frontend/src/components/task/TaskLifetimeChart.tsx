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
        background: "#00000000",
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
            autoSelected: "pan",
        },
        selection: {
            enabled: false,
        },
        zoom: {
            enabled: false,
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

const getFinishedAt = (task: StateTask) =>
    task.succeededAt || task.failedAt || task.retriedAt || task.rejectedAt || task.revokedAt
const getStartedAt = (task: StateTask) => task.startedAt || task.revokedAt || task.rejectedAt
const getReceivedAt = (task: StateTask) => task.receivedAt || task.revokedAt

const getSeries = (task: StateTask, now: Date): ApexAxisChartSeries => [
    {
        name: "Waiting in Queue",
        data: [{ y: [getTimestamp(task.sentAt), getTimestamp(getReceivedAt(task) || now)], x: task.id }],
    },
    {
        name: "Waiting in Worker",
        data: [{ y: [getTimestamp(getReceivedAt(task) || now), getTimestamp(getStartedAt(task) || now)], x: task.id }],
    },
    {
        name: "Running",
        data: [{ y: [getTimestamp(getStartedAt(task) || now), getTimestamp(getFinishedAt(task) || now)], x: task.id }],
    },
]

const TaskLifetimeChart: React.FC<TaskLifetimeChart> = ({ task }) => {
    const theme = useTheme()
    const isRealtime = useMemo(
        () =>
            getReceivedAt(task) === undefined || getStartedAt(task) === undefined || getFinishedAt(task) === undefined,
        [task],
    )
    const now = useNow(isRealtime ? REALTIME_INTERVAL : 0)
    const options = useMemo(() => getOptions(theme), [theme])
    const series = useMemo(() => getSeries(task, now), [task, now])

    return <Chart type="rangeBar" options={options} series={series} width="100%" height="120px" />
}

export default TaskLifetimeChart
