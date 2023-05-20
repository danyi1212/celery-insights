import { simulateTask } from "@utils/simulator/taskSimulator"
import React, { useEffect } from "react"

const INTERVAL = 5 * 1000 // 3 seconds
const DemoSimulator: React.FC = () => {
    useEffect(() => {
        const token = setInterval(() => {
            simulateTask("demo_task").then()
        }, INTERVAL)
        return () => clearInterval(token)
    }, [])
    return <></>
}
export default DemoSimulator
