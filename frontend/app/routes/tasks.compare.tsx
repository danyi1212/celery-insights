import { createFileRoute, useNavigate } from "@tanstack/react-router"
import TaskComparisonView from "@components/task/comparison/task-comparison-view"
import TaskComparisonPicker from "@components/task/comparison/task-comparison-picker"
import { z } from "zod"

const searchSchema = z.object({
    left: z.string().optional(),
    right: z.string().optional(),
    type: z.string().optional(),
})

const TaskComparePage = () => {
    const { left, right, type } = Route.useSearch()
    const navigate = useNavigate()

    const setLeft = (id: string) => navigate({ to: "/tasks/compare", search: (prev) => ({ ...prev, left: id }) })
    const setRight = (id: string) => navigate({ to: "/tasks/compare", search: (prev) => ({ ...prev, right: id }) })

    if (left && right) {
        return (
            <TaskComparisonView
                leftId={left}
                rightId={right}
                onChangeLeft={setLeft}
                onChangeRight={setRight}
                taskType={type}
            />
        )
    }

    return (
        <TaskComparisonPicker
            leftId={left}
            rightId={right}
            taskType={type}
            onSelectLeft={setLeft}
            onSelectRight={setRight}
        />
    )
}

export const Route = createFileRoute("/tasks/compare")({
    component: TaskComparePage,
    validateSearch: searchSchema,
})
