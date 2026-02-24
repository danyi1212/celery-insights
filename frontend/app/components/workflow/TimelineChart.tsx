import { useNow } from "@hooks/useNow"
import { useIsDark } from "@hooks/useIsDark"
import { useTourChangeStepOnLoad } from "@stores/useTourStore"
import { formatDurationExact } from "@utils/FormatDurationExact"
import { StateTask } from "@utils/translateServerModels"
import { ApexOptions } from "apexcharts"
import { Download, Maximize2, Move, ScanSearch, ZoomIn, ZoomOut } from "lucide-react"
import React, { useMemo } from "react"
import Chart from "react-apexcharts"
import { renderToString } from "react-dom/server"
import { useNavigate } from "@tanstack/react-router"

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
const getOptions = (isDark: boolean, navigate: (to: string) => void): ApexOptions => ({
    chart: {
        background: isDark ? "oklch(0.20 0.01 155)" : "oklch(0.98 0.005 150)",
        foreColor: isDark ? "#e8e5de" : "#1f2117",
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
                download: renderToString(<Download size={14} />),
                selection: renderToString(<ScanSearch size={14} />),
                pan: renderToString(<Move size={14} />),
                reset: renderToString(<Maximize2 size={14} />),
                zoomout: renderToString(<ZoomOut size={14} />),
                zoomin: renderToString(<ZoomIn size={14} />),
                zoom: renderToString(<ScanSearch size={14} />),
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
        mode: isDark ? "dark" : "light",
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
            return formatDurationExact(duration)
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
    useTourChangeStepOnLoad(5)
    const isDark = useIsDark()
    const navigate = useNavigate()
    const sortedTasks = useMemo(() => tasks.sort((a, b) => (a.sentAt > b.sentAt ? 1 : -1)), [tasks])
    const isRealtime = useMemo(
        () => tasks.find((task) => (task.succeededAt || task.failedAt) === undefined) !== undefined,
        [tasks],
    )
    const now = useNow(isRealtime ? REALTIME_INTERVAL : undefined)
    const series = useMemo(() => getSeries(sortedTasks, now), [sortedTasks, now])
    const options: ApexOptions = useMemo(() => getOptions(isDark, navigate), [isDark, navigate])
    const isLarge = useMemo(() => tasks.length > 15, [tasks])
    return (
        <div className={`h-full pt-[17px] overflow-x-clip ${isLarge ? "overflow-y-auto" : "overflow-y-clip"}`}>
            <Chart
                type="rangeBar"
                options={options}
                series={series}
                height={isLarge ? tasks.length * 25 : "100%"}
                width="100%"
            />
        </div>
    )
}

export default TimelineChart
