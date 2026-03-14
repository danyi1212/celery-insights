import Panel from "@components/common/panel"
import JsonViewThemed from "@components/common/json-view-themed"
import { useTask } from "@hooks/use-live-tasks"
import type { SurrealTask } from "@/types/surreal-records"
import React from "react"

interface ResultCardProps {
    taskId: string
}

interface CardContentProps {
    task?: SurrealTask | null
}

const normalizeJsonViewValue = (value: unknown): object => {
    if (value !== null && typeof value === "object") {
        return value
    }
    return { result: value }
}

const tryParseJson = (str: string): unknown => {
    try {
        return JSON.parse(str)
    } catch {
        return str
    }
}

const CardContent: React.FC<CardContentProps> = ({ task }) => {
    if (!task) return <p>Could not find task result.</p>

    if (!task.result) return <p>No result available.</p>

    const parsed = tryParseJson(task.result)

    return <JsonViewThemed value={normalizeJsonViewValue(parsed)} />
}

const ResultCard: React.FC<ResultCardProps> = ({ taskId }) => {
    const { task, isLoading, error } = useTask(taskId)
    return (
        <Panel title="Result" loading={isLoading} error={error}>
            <CardContent task={task} />
        </Panel>
    )
}

export default ResultCard
