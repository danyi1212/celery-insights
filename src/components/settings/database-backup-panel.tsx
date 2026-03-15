import Panel from "@components/common/panel"
import { useSurrealDB } from "@components/surrealdb-provider"
import { Button } from "@components/ui/button"
import useSettingsStore from "@stores/use-settings-store"
import { useQueryClient } from "@tanstack/react-query"
import { Database, Download, Loader2, Upload } from "lucide-react"
import React, { useCallback, useRef, useState } from "react"

export const DatabaseBackupPanel: React.FC<{ hideHeader?: boolean }> = ({ hideHeader = false }) => {
  const isDemo = useSettingsStore((state) => state.demo)
  const { appConfig } = useSurrealDB()
  const snapshotEnabled = appConfig?.debugSnapshot?.enabled === true
  const queryClient = useQueryClient()
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = useCallback(async () => {
    setIsExporting(true)
    setImportResult(null)
    try {
      const response = await fetch("/api/settings/export")
      if (!response.ok) return
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = "celery_insights_backup.json"
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Export failed:", err)
    } finally {
      setIsExporting(false)
    }
  }, [])

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      setIsImporting(true)
      setImportResult(null)
      try {
        const formData = new FormData()
        formData.append("file", file)
        const response = await fetch("/api/settings/import", {
          method: "POST",
          body: formData,
        })
        const result = await response.json()
        if (result.success) {
          const { tasks, events, workers } = result.imported
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["settings-info"] }),
            queryClient.invalidateQueries({ queryKey: ["retention-settings"] }),
          ])
          setImportResult(`Imported ${tasks} tasks, ${events} events, ${workers} workers`)
        } else {
          setImportResult(`Import failed: ${result.error}`)
        }
      } catch (err) {
        console.error("Import failed:", err)
        setImportResult("Import failed — check console for details")
      } finally {
        setIsImporting(false)
        // Reset file input so the same file can be selected again
        if (fileInputRef.current) fileInputRef.current.value = ""
      }
    },
    [queryClient],
  )

  return (
    <Panel title="Backups" titleClassName="text-lg" hideHeader={hideHeader}>
      <div className="space-y-4 p-4">
        <p className="text-sm text-muted-foreground">Export the current dataset or restore one from a backup file.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} disabled={isDemo || isExporting}>
            {isExporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Export Backup
          </Button>
          <Button variant="outline" onClick={handleImportClick} disabled={isDemo || snapshotEnabled || isImporting}>
            {isImporting ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Import Backup
          </Button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileSelected} />
        </div>
        {(isDemo || snapshotEnabled) && (
          <p className="text-sm text-muted-foreground">
            {isDemo ? "Unavailable while demo mode is active." : "Import is disabled during snapshot replay."}
          </p>
        )}
        {importResult && (
          <p className="flex items-center gap-2 text-sm">
            <Database className="size-4 text-muted-foreground" />
            {importResult}
          </p>
        )}
      </div>
    </Panel>
  )
}
