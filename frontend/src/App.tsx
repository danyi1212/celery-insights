import Typography from "@mui/material/Typography"
import { useRecoilValue } from "recoil"
import { tasksState } from "./atoms/tasks"

function App() {
    const tasks = useRecoilValue(tasksState)

    return (
        <div>
            <Typography variant="h1" align="center">
                Celery Soup
            </Typography>
            <ul>
                {Array.from(tasks.entries()).map(([task_id, task]) => (
                    <li key={task_id}>
                        {task.id} | {task.type} Hello world
                    </li>
                ))}
            </ul>
        </div>
    )
}

export default App
