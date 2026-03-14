import { Alert, AlertDescription, AlertTitle } from "@components/ui/alert"
import { Button } from "@components/ui/button"
import { Checkbox } from "@components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@components/ui/dialog"
import useSettingsStore from "@stores/use-settings-store"
import { AlertCircle, Download, Loader2, TriangleAlert } from "lucide-react"
import React, { useMemo, useState } from "react"

function getDownloadFilename(response: Response): string {
    const contentDisposition = response.headers?.get("Content-Disposition")
    if (!contentDisposition) return "celery-insights-debug-bundle.zip"

    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
    if (utf8Match?.[1]) {
        return decodeURIComponent(utf8Match[1])
    }

    const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/i)
    return filenameMatch?.[1] ?? "celery-insights-debug-bundle.zip"
}

export const DownloadDebugBundleButton: React.FC<{ label?: string }> = ({ label = "Download diagnostics" }) => {
    const isDemo = useSettingsStore((state) => state.demo)
    const [isLoading, setIsLoading] = useState(false)
    const [open, setOpen] = useState(false)
    const [includeSecrets, setIncludeSecrets] = useState(false)
    const [statusMessage, setStatusMessage] = useState<string | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const includeSecretsId = "download-debug-bundle-include-secrets"

    const clientInfo = useMemo(
        () => ({
            includeSecrets,
            settings: useSettingsStore.getState(),
            screenWidth: window.innerWidth,
            screenHeight: window.innerHeight,
            userAgent: window.navigator.userAgent,
            locale: window.navigator.language ?? null,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
            colorScheme: window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light",
            devicePixelRatio: window.devicePixelRatio ?? 1,
        }),
        [includeSecrets],
    )

    const handleDownloadDebugBundle = async () => {
        setIsLoading(true)
        setErrorMessage(null)
        setStatusMessage("Preparing debug bundle. This can take a moment.")
        try {
            const response = await fetch("/api/settings/download-debug-bundle", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(clientInfo),
            })
            if (!response.ok) {
                let message = `Bundle download failed (${response.status})`
                try {
                    const payload = (await response.json()) as { error?: string; detail?: string }
                    message = payload.error ?? payload.detail ?? message
                } catch {
                    // Keep default message when the response is not JSON.
                }
                throw new Error(message)
            }

            const filename = getDownloadFilename(response)
            const blob = await response.blob()
            const blobUrl = window.URL.createObjectURL(blob)

            const anchor = document.createElement("a")
            anchor.href = blobUrl
            anchor.download = filename
            document.body.appendChild(anchor)
            anchor.click()

            document.body.removeChild(anchor)
            URL.revokeObjectURL(blobUrl)
            setOpen(false)
            setStatusMessage(null)
        } catch (error) {
            console.error("Failed to download debug bundle:", error)
            setErrorMessage(error instanceof Error ? error.message : "Failed to prepare the debug bundle.")
            setStatusMessage(null)
        } finally {
            setIsLoading(false)
        }
    }

    const handleOpenChange = (nextOpen: boolean) => {
        if (!isLoading) {
            setOpen(nextOpen)
        }
        if (nextOpen) {
            setErrorMessage(null)
            setStatusMessage(null)
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline" disabled={isDemo || isLoading}>
                    {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                    <span>{isLoading ? "Preparing bundle..." : label}</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogTitle>Download debug bundle v2</DialogTitle>
                <DialogDescription>
                    The bundle includes effective config, diagnostics, SurrealDB data, recent process logs, and local UI
                    settings.
                </DialogDescription>
                <div className="space-y-4 pt-2">
                    <div className="flex items-start gap-3 rounded-2xl border bg-background/60 p-4">
                        <Checkbox
                            id={includeSecretsId}
                            checked={includeSecrets}
                            onCheckedChange={(checked) => setIncludeSecrets(checked === true)}
                        />
                        <div className="space-y-1">
                            <label htmlFor={includeSecretsId} className="text-sm font-medium">
                                Include secrets
                            </label>
                            <p className="text-sm text-muted-foreground">
                                Off by default. Keep this disabled unless you explicitly need broker, backend, or
                                database credentials in the bundle.
                            </p>
                        </div>
                    </div>
                    {includeSecrets && (
                        <div className="rounded-2xl border border-status-warning/30 bg-status-warning/10 p-4 text-sm text-status-warning">
                            <TriangleAlert className="mr-2 inline-block size-4 -translate-y-px" />
                            This download will include sensitive runtime credentials.
                        </div>
                    )}
                    {statusMessage && (
                        <p className="text-sm text-muted-foreground" aria-live="polite">
                            {statusMessage}
                        </p>
                    )}
                    {errorMessage && (
                        <Alert variant="destructive">
                            <AlertCircle />
                            <AlertTitle>Bundle preparation failed</AlertTitle>
                            <AlertDescription>{errorMessage}</AlertDescription>
                        </Alert>
                    )}
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setOpen(false)} disabled={isLoading}>
                            Cancel
                        </Button>
                        <Button onClick={handleDownloadDebugBundle} disabled={isLoading}>
                            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                            {isLoading ? "Preparing bundle..." : "Download bundle"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
