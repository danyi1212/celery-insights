import { simulateTask } from "@utils/simulator/taskSimulator"
import { simulateWorker } from "@utils/simulator/workerSimulator"
import React, { useEffect } from "react"

const INTERVAL = 5 * 1000 // 3 seconds
const DemoSimulator: React.FC = () => {
    useEffect(() => {
        const worker1Token = simulateWorker("worker@1", 123)
        const worker2Token = simulateWorker("worker@2", 123)
        const worker3Token = simulateWorker("worker@3", 123)
        const taskIntervalToken = setInterval(() => {
            simulateTask("demo_task").then()
        }, INTERVAL)
        return () => {
            clearInterval(worker1Token)
            clearInterval(worker2Token)
            clearInterval(worker3Token)
            clearInterval(taskIntervalToken)
        }
    }, [])
    return <></>
}
export default DemoSimulator
