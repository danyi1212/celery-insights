import { useNow } from "@hooks/useNow"
import DownloadIcon from "@mui/icons-material/Download"
import HighlightAltIcon from "@mui/icons-material/HighlightAlt"
import PanToolIcon from "@mui/icons-material/PanTool"
import ZoomInIcon from "@mui/icons-material/ZoomIn"
import ZoomOutIcon from "@mui/icons-material/ZoomOut"
import ZoomOutMapIcon from "@mui/icons-material/ZoomOutMap"
import { Theme, useTheme } from "@mui/material"
import Box from "@mui/material/Box"
import { StateTask } from "@utils/translateServerModels"
import { ApexOptions } from "apexcharts"
import React, { useMemo } from "react"
import Chart from "react-apexcharts"
import { renderToString } from "react-dom/server"
import { useNavigate } from "react-router-dom"

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
const getOptions = (theme: Theme, navigate: ReturnType<useNavigate>): ApexOptions => ({
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
            autoSelected: "pan",
            offsetX: -15,
            offsetY: -15,
            tools: {
                download: renderToString(<DownloadIcon />),
                selection: renderToString(<HighlightAltIcon />),
                pan: renderToString(<PanToolIcon />),
                reset: renderToString(<ZoomOutMapIcon />),
                zoomout: renderToString(<ZoomOutIcon />),
                zoomin: renderToString(<ZoomInIcon />),
                zoom: renderToString(<HighlightAltIcon />),
            },
        },
        zoom: {
            enabled: true,
            type: "xy",
        },
        events: {
            dataPointSelection: (event, chartContext, config) => {
                const dataPoint = config.w.config.series[config.seriesIndex].data[config.dataPointIndex]
                navigate(`/tasks/${dataPoint.x}`)
            },
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
            columnWidth: "15px",
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
            const minutes = Math.floor(duration / 60_000)
            const seconds = Math.floor((duration % 60_000) / 1000)
            const ms = duration % 1000
            if (minutes) return `${minutes}min, ${seconds}.${ms}s`
            else if (seconds) return `${seconds}.${ms}s`
            else return `${ms}ms`
        },
    },
    xaxis: {
        type: "datetime",
        position: "top",
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
    const navigate = useNavigate()
    const sortedTasks = useMemo(() => tasks.sort((a, b) => (a.sentAt > b.sentAt ? 1 : -1)), [tasks])
    const isRealtime = useMemo(
        () => tasks.find((task) => (task.succeededAt || task.failedAt) === undefined) !== undefined,
        [tasks]
    )
    const now = useNow(isRealtime ? REALTIME_INTERVAL : undefined)
    const series = useMemo(() => getSeries(sortedTasks, now), [sortedTasks, now])
    const options: ApexOptions = useMemo(() => getOptions(theme, navigate), [theme, navigate])
    const isLarge = useMemo(() => tasks.length > 15, [tasks])
    return (
        <Box sx={{ overflowY: isLarge ? "auto" : "clip", overflowX: "clip" }} height="100%" pt="17px">
            <Chart
                type="rangeBar"
                options={options}
                series={series}
                height={isLarge ? tasks.length * 25 : "100%"}
                width="100%"
            />
        </Box>
    )
}

export default TimelineChart
