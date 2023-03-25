import { Theme, useTheme } from "@mui/material"
import { StateTask } from "@utils/translateServerModels"
import { ApexOptions } from "apexcharts"
import { formatDistanceStrict } from "date-fns"
import React, { useMemo } from "react"
import Chart from "react-apexcharts"

const getTimestamp = (date: Date | undefined) => date?.getTime() || new Date().getTime()

const getSeries = (tasks: StateTask[]): ApexAxisChartSeries => {
    const data = tasks
        .sort((a, b) => (a.sentAt > b.sentAt ? 1 : -1))
        .map((task) => ({
            x: task.id,
            y: [getTimestamp(task.startedAt), getTimestamp(task.succeededAt || task.failedAt)],
        }))
    console.log(data[data.length - 1])
    return [
        {
            data,
        },
    ]
}

const getOptions = (theme: Theme): ApexOptions => ({
    chart: {
        background: theme.palette.background.paper,
        foreColor: theme.palette.text.primary,
        fontFamily: theme.typography.fontFamily,
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
            return formatDistanceStrict(first, second)
        },
    },
    xaxis: { type: "datetime" },
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
    const series = useMemo(() => getSeries(tasks), [tasks])
    const options: ApexOptions = useMemo(() => getOptions(theme), [theme])
    return <Chart type="rangeBar" options={options} series={series} height="100%" width="100%" />
}

export default TimelineChart
