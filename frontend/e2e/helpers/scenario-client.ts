const BASE_URL = process.env.E2E_INTERACTIVE_URL ?? "http://localhost:8000"

export class ScenarioClient {
    async triggerScenario(name: string): Promise<{ scenario: string; task_id: string }> {
        const res = await fetch(`${BASE_URL}/scenarios/${name}`, { method: "POST" })
        if (!res.ok) throw new Error(`Scenario "${name}" failed: ${res.status} ${await res.text()}`)
        return res.json()
    }

    async triggerAll(): Promise<Record<string, string>> {
        const res = await fetch(`${BASE_URL}/all`, { method: "POST" })
        if (!res.ok) throw new Error(`Trigger all failed: ${res.status}`)
        return res.json()
    }

    async triggerBurst(count = 10): Promise<{ task_ids: string[] }> {
        const res = await fetch(`${BASE_URL}/burst?count=${count}`, { method: "POST" })
        if (!res.ok) throw new Error(`Burst failed: ${res.status}`)
        return res.json()
    }

    async revokeTask(taskId: string, terminate = false): Promise<void> {
        const res = await fetch(`${BASE_URL}/revoke/${taskId}?terminate=${terminate}`, { method: "POST" })
        if (!res.ok) throw new Error(`Revoke failed: ${res.status}`)
    }
}
