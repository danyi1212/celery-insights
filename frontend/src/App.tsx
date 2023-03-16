import Typography from "@mui/material/Typography"
import { useStateStore } from "@stores/useStateStore"

function App() {
    const tasks = useStateStore((state) => state.tasks)

    return (
        <div>
            <Typography variant="h1" align="center">
                Celery Soup
            </Typography>
            <ul>
                {Array.from(tasks.entries()).map(([task_id, task]) => (
                    <li key={task_id}>
                        {task.id} | {task.type} | {task.state}
                    </li>
                ))}
            </ul>
        </div>
    )
}

export default App
