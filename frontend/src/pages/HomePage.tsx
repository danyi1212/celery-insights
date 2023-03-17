import { useStateStore } from "@stores/useStateStore"

function HomePage() {
    const tasks = useStateStore((state) => state.tasks)

    return (
        <ul>
            {Array.from(tasks.entries()).map(([task_id, task]) => (
                <li key={task_id}>
                    {task.id} | {task.type} | {task.state}
                </li>
            ))}
        </ul>
    )
}

export default HomePage
