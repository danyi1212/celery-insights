import Panel from "@components/common/panel"
import { useTask } from "@hooks/use-live-tasks"
import { useIsDark } from "@hooks/use-is-dark"
import type { SurrealTask } from "@/types/surreal-records"
import JsonView from "@uiw/react-json-view"
import { githubDarkTheme } from "@uiw/react-json-view/githubDark"
import { githubLightTheme } from "@uiw/react-json-view/githubLight"
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
    const isDark = useIsDark()

    if (!task) return <p>Could not find task result.</p>

    if (!task.result) return <p>No result available.</p>

    const parsed = tryParseJson(task.result)

    return (
        <JsonView
            value={normalizeJsonViewValue(parsed)}
            style={isDark ? githubDarkTheme : githubLightTheme}
            collapsed={2}
            displayDataTypes={false}
            enableClipboard={false}
        />
    )
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
