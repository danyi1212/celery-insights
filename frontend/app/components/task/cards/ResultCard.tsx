import Panel from "@components/common/Panel"
import useTaskResult from "@hooks/task/useTaskResult"
import { useIsDark } from "@hooks/useIsDark"
import { TaskResult } from "@services/server"
import JsonView from "@uiw/react-json-view"
import { githubDarkTheme } from "@uiw/react-json-view/githubDark"
import { githubLightTheme } from "@uiw/react-json-view/githubLight"
import React from "react"

interface ResultCardProps {
    taskId: string
}

interface CardContentProps {
    result?: TaskResult
}

const normalizeJsonViewValue = (value: unknown): object => {
    if (value !== null && typeof value === "object") {
        return value
    }
    return { result: value }
}

const CardContent: React.FC<CardContentProps> = ({ result }) => {
    const isDark = useIsDark()

    if (!result) return <p>Could not find task result.</p>

    if (result.ignored)
        return (
            <p>
                Task is configured to{" "}
                <a
                    target="_blank"
                    rel="noopener noreferrer"
                    href="https://docs.celeryq.dev/en/stable/userguide/tasks.html#Task.ignore_result"
                    className="text-primary underline hover:opacity-80"
                >
                    ignore result
                </a>
                .
            </p>
        )

    if (result.result == null) return <p>No result available.</p>

    return (
        <JsonView
            value={normalizeJsonViewValue(result.result)}
            style={isDark ? githubDarkTheme : githubLightTheme}
            collapsed={2}
            displayDataTypes={false}
            enableClipboard={false}
        />
    )
}

const ResultCard: React.FC<ResultCardProps> = ({ taskId }) => {
    const { taskResult, isLoading, error } = useTaskResult(taskId)
    return (
        <Panel title="Result" loading={isLoading} error={error}>
            <CardContent result={taskResult} />
        </Panel>
    )
}

export default ResultCard
