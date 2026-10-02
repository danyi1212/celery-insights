import Panel from "@components/common/panel"
import { useSurrealDB } from "@components/surrealdb-provider"
import { Badge } from "@components/ui/badge"
import { Button } from "@components/ui/button"
import { Input } from "@components/ui/input"
import { Separator } from "@components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@components/ui/tooltip"
import useSettingsStore from "@stores/use-settings-store"
import { useQuery } from "@tanstack/react-query"
import { Database, Loader2, Play, Save, RotateCw } from "lucide-react"
import React, { useCallback, useEffect, useState } from "react"

interface RetentionSettings {
  cleanup_interval_seconds: number
  task_max_count: number | null
  task_retention_hours: number | null
  dead_worker_retention_hours: number | null
}

interface RecordCounts {
  tasks: number
  events: number
  workers: number
}

interface RetentionInfo {
  settings: RetentionSettings
  counts: RecordCounts
}

const fetchRetention = async (): Promise<RetentionInfo> => {
  const res = await fetch("/api/settings/retention")
  if (!res.ok) throw new Error(`Failed to load retention settings: ${res.status}`)
  return res.json()
}

const FieldRow: React.FC<{
  label: string
  description: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}> = ({ label, description, value, onChange, placeholder, type = "text" }) => (
  <div className="flex items-center gap-4">
    <div className="min-w-0 flex-1">
      <div className="text-sm font-medium">{label}</div>
      <div className="text-xs text-muted-foreground">{description}</div>
    </div>
    <Input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-32 text-right"
    />
  </div>
)

export const RetentionPolicyPanel: React.FC<{ hideHeader?: boolean }> = ({ hideHeader = false }) => {
  const isDemo = useSettingsStore((state) => state.demo)
  const { appConfig } = useSurrealDB()
  const { data, refetch } = useQuery({
    queryKey: ["retention-settings", isDemo ? "demo" : "live"],
    queryFn: fetchRetention,
    enabled: !isDemo,
  })

  const [taskMaxCount, setTaskMaxCount] = useState("")
  const [taskRetentionHours, setTaskRetentionHours] = useState("")
  const [deadWorkerRetentionHours, setDeadWorkerRetentionHours] = useState("")
  const [cleanupInterval, setCleanupInterval] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [isCleaning, setIsCleaning] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const snapshotEnabled = appConfig?.debugSnapshot?.enabled === true

  useEffect(() => {
    if (data) {
      setTaskMaxCount(data.settings.task_max_count?.toString() ?? "")
      setTaskRetentionHours(data.settings.task_retention_hours?.toString() ?? "")
      setDeadWorkerRetentionHours(data.settings.dead_worker_retention_hours?.toString() ?? "")
      setCleanupInterval(data.settings.cleanup_interval_seconds.toString())
      setHasChanges(false)
    }
  }, [data])

  const handleFieldChange = useCallback(
    (setter: (v: string) => void) => (value: string) => {
      setter(value)
      setHasChanges(true)
      setStatusMessage(null)
    },
    [],
  )

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    setStatusMessage(null)
    try {
      const body: RetentionSettings = {
        cleanup_interval_seconds: parseInt(cleanupInterval) || 60,
        task_max_count: taskMaxCount ? parseInt(taskMaxCount) : null,
        task_retention_hours: taskRetentionHours ? parseFloat(taskRetentionHours) : null,
        dead_worker_retention_hours: deadWorkerRetentionHours ? parseFloat(deadWorkerRetentionHours) : null,
      }
      const res = await fetch("/api/settings/retention", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`Save failed: ${res.status}`)
      await refetch()
      setStatusMessage("Applied to the running instance")
      setHasChanges(false)
    } catch (err) {
      setStatusMessage(`Save failed: ${err instanceof Error ? err.message : "unknown error"}`)
    } finally {
      setIsSaving(false)
    }
  }, [cleanupInterval, taskMaxCount, taskRetentionHours, deadWorkerRetentionHours, refetch])

  const handleCleanup = useCallback(async () => {
    setIsCleaning(true)
    setStatusMessage(null)
    try {
      const res = await fetch("/api/settings/cleanup", { method: "POST" })
      if (!res.ok) throw new Error(`Cleanup failed: ${res.status}`)
      const result = await res.json()
      if (result.success) {
        await refetch()
        setStatusMessage("Cleanup completed")
      } else {
        setStatusMessage(`Cleanup failed: ${result.error}`)
      }
    } catch (err) {
      setStatusMessage(`Cleanup failed: ${err instanceof Error ? err.message : "unknown error"}`)
    } finally {
      setIsCleaning(false)
    }
  }, [refetch])

  return (
    <Panel title="Cleanup rules" titleClassName="text-lg" hideHeader={hideHeader}>
      <div className="space-y-4 p-4">
        {isDemo ? (
          <div className="rounded-2xl border bg-background/60 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Demo mode</Badge>
              <span className="text-sm font-medium">Cleanup controls are turned off</span>
            </div>
            <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
              Demo mode does not connect to a live instance, so cleanup rules are not applied. You can start a clean
              demo by refreshing the page.
            </p>
          </div>
        ) : snapshotEnabled ? (
          <div className="rounded-2xl border bg-background/60 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Snapshot replay</Badge>
              <span className="text-sm font-medium">Cleanup controls are read-only</span>
            </div>
            <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
              Retention changes and manual cleanup are disabled while replaying a mounted debug bundle.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border bg-background/60 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Runtime only</Badge>
                <span className="text-sm font-medium">Applies until restart</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                These controls affect the running cleanup job only. Use config or environment variables to keep the same
                defaults after a restart.
              </p>
            </div>

            <div className="flex gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Database className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">Tasks:</span>
                <span className="font-medium">{data?.counts.tasks.toLocaleString() ?? "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Events:</span>{" "}
                <span className="font-medium">{data?.counts.events.toLocaleString() ?? "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Workers:</span>{" "}
                <span className="font-medium">{data?.counts.workers.toLocaleString() ?? "—"}</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <FieldRow
                label="Max task count"
                description="Keep at most this many tasks (empty = unlimited)"
                value={taskMaxCount}
                onChange={handleFieldChange(setTaskMaxCount)}
                placeholder="unlimited"
                type="number"
              />
              <FieldRow
                label="Task retention (hours)"
                description="Delete tasks older than this (empty = no age limit)"
                value={taskRetentionHours}
                onChange={handleFieldChange(setTaskRetentionHours)}
                placeholder="unlimited"
                type="number"
              />
              <FieldRow
                label="Dead worker retention (hours)"
                description="Delete offline workers older than this (empty = keep forever)"
                value={deadWorkerRetentionHours}
                onChange={handleFieldChange(setDeadWorkerRetentionHours)}
                placeholder="forever"
                type="number"
              />
              <FieldRow
                label="Cleanup interval (seconds)"
                description="How often cleanup runs"
                value={cleanupInterval}
                onChange={handleFieldChange(setCleanupInterval)}
                type="number"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={handleSave}
                disabled={isDemo || snapshotEnabled || isSaving || !hasChanges}
              >
                {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Apply to running instance
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCleanup}
                    disabled={isDemo || snapshotEnabled || isCleaning}
                  >
                    {isCleaning ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                    Run cleanup now
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Run cleanup once with the current rules</TooltipContent>
              </Tooltip>
            </div>

            {statusMessage && <p className="text-sm text-muted-foreground">{statusMessage}</p>}
          </>
        )}
      </div>
    </Panel>
  )
}

export const RetentionPolicyPanelAction: React.FC = () => {
  const isDemo = useSettingsStore((state) => state.demo)
  const { appConfig } = useSurrealDB()
  const { isLoading, refetch } = useQuery({
    queryKey: ["retention-settings", isDemo ? "demo" : "live"],
    queryFn: fetchRetention,
    enabled: !isDemo,
  })
  const snapshotEnabled = appConfig?.debugSnapshot?.enabled === true

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => refetch().then()}
          disabled={isLoading || isDemo || snapshotEnabled}
        >
          <RotateCw className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Refresh</TooltipContent>
    </Tooltip>
  )
}
