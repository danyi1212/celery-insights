import { authenticatedFetch } from "@lib/authenticated-fetch"
import { markRemoteObservation } from "@lib/observation-query"
import { appUrl } from "@lib/app-url"
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react"
import { Surreal, type ConnectionStatus } from "surrealdb"
import useSettingsStore, { applyDeploymentDefaults } from "@stores/use-settings-store"
import { Progress } from "@components/ui/progress"
import { Button } from "@components/ui/button"
import { DEMO_SCHEMA } from "@lib/demo-schema"
import { DemoEventGenerator } from "@lib/demo-event-generator"

export type IngestionStatus = "leader" | "standby" | "read-only" | "disabled"

interface AppConfig {
  ui?: Parameters<typeof applyDeploymentDefaults>[0]
  observationPath: string
  ingestionStatus: IngestionStatus
  debugSnapshot: {
    enabled: boolean
    readOnly: boolean
    bundlePath?: string
    manifestVersion?: number
    capturedAt?: string
    replayedAt?: string
    redacted?: boolean
    recordCounts?: {
      tasks: number
      events: number
      workers: number
    }
  } | null
}

interface SurrealDBContextValue {
  db: Surreal
  status: ConnectionStatus
  ingestionStatus: IngestionStatus
  error: Error | null
  appConfig: AppConfig | null
}

const SurrealDBContext = createContext<SurrealDBContextValue | null>(null)

export const useSurrealDB = (): SurrealDBContextValue => {
  const ctx = useContext(SurrealDBContext)
  if (!ctx) throw new Error("useSurrealDB must be used within SurrealDBProvider")
  return ctx
}

const NAMESPACE = "celery_insights"
const DATABASE = "main"

async function fetchConfig(): Promise<AppConfig> {
  const res = await authenticatedFetch(appUrl("/api/config"))
  if (!res.ok) throw new Error(`Failed to fetch config: ${res.status}`)
  return res.json()
}

async function connectObservations(db: Surreal, observationPath: string): Promise<void> {
  markRemoteObservation(db)
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
  await db.connect(`${protocol}//${window.location.host}${observationPath}`)
}

interface SurrealDBProviderProps {
  children: React.ReactNode
}

const SurrealDBProvider = ({ children }: SurrealDBProviderProps) => {
  const isDemo = useSettingsStore((state) => state.demo)
  useEffect(() => {
    if (!isDemo) return
    let active = true
    fetchConfig()
      .then((config) => {
        if (active && config.ui) applyDeploymentDefaults(config.ui)
      })
      .catch(() => {
        // Frontend-only demos have no deployment configuration endpoint.
      })
    return () => {
      active = false
    }
  }, [isDemo])

  if (isDemo) {
    return <DemoSurrealDBProvider>{children}</DemoSurrealDBProvider>
  }

  return <RemoteSurrealDBProvider>{children}</RemoteSurrealDBProvider>
}

// --- Remote (production) provider ---

const RemoteSurrealDBProvider = ({ children }: { children: React.ReactNode }) => {
  const dbRef = useRef<Surreal>(new Surreal())
  const [status, setStatus] = useState<ConnectionStatus>("disconnected")
  const [ingestionStatus, setIngestionStatus] = useState<IngestionStatus>("disabled")
  const [error, setError] = useState<Error | null>(null)
  const [configLoaded, setConfigLoaded] = useState(false)
  const configRef = useRef<AppConfig | null>(null)

  // Subscribe to connection status events
  useEffect(() => {
    const db = dbRef.current
    const unsubs = [
      db.subscribe("connecting", () => setStatus("connecting")),
      db.subscribe("connected", () => {
        setStatus("connected")
        setError(null)
      }),
      db.subscribe("reconnecting", () => setStatus("reconnecting")),
      db.subscribe("disconnected", () => setStatus("disconnected")),
      db.subscribe("error", (err) => setError(err)),
    ]

    return () => {
      unsubs.forEach((unsub) => unsub())
    }
  }, [])

  // Configuration and database transport both pass through Bun authentication.
  useEffect(() => {
    fetchConfig()
      .then((config) => {
        if (config.ui) applyDeploymentDefaults(config.ui)
        configRef.current = config
        setIngestionStatus(config.ingestionStatus)
        setConfigLoaded(true)
      })
      .catch((err) => {
        setError(err instanceof Error ? err : new Error("Application configuration unavailable"))
        setConfigLoaded(true)
      })
  }, [])

  // Application authentication is already established by browser navigation.
  useEffect(() => {
    if (!configLoaded || !configRef.current) return
    const config = configRef.current
    connectObservations(dbRef.current, config.observationPath).catch((err) =>
      setError(err instanceof Error ? err : new Error(String(err))),
    )
  }, [configLoaded])

  // Clean up on unmount
  useEffect(() => {
    const db = dbRef.current
    return () => {
      db.close()
    }
  }, [])

  const contextValue = useMemo<SurrealDBContextValue>(
    () => ({
      db: dbRef.current,
      status,
      ingestionStatus,
      error,
      appConfig: configRef.current,
    }),
    [status, ingestionStatus, error],
  )

  // Loading state while fetching config
  if (!configLoaded) {
    return <RemoteLoadingScreen />
  }

  // Block initial app render until first successful database connection.
  // This avoids route-level flicker and gives users a single clear loading state.
  if (status !== "connected") {
    return <RemoteLoadingScreen status={status} error={error} />
  }

  return <SurrealDBContext.Provider value={contextValue}>{children}</SurrealDBContext.Provider>
}

// --- Demo (embedded WASM) provider ---

type DemoLoadingStage = "downloading" | "initializing" | "ready"

const DemoSurrealDBProvider = ({ children }: { children: React.ReactNode }) => {
  const dbRef = useRef<Surreal | null>(null)
  const generatorRef = useRef<DemoEventGenerator | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>("disconnected")
  const [error, setError] = useState<Error | null>(null)
  const [loadingStage, setLoadingStage] = useState<DemoLoadingStage>("downloading")
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    const initDemo = async () => {
      try {
        // Stage 1: Lazy-load the WASM engine module
        setLoadingStage("downloading")
        const { createWasmEngines } = await import("@surrealdb/wasm")
        if (cancelled) return

        // Stage 2: Initialize the embedded database
        setLoadingStage("initializing")
        const db = new Surreal({
          engines: createWasmEngines(),
        })

        // Subscribe to connection status events
        db.subscribe("connected", () => {
          if (!cancelled) setStatus("connected")
        })
        db.subscribe("disconnected", () => {
          if (!cancelled) setStatus("disconnected")
        })
        db.subscribe("error", (err) => {
          if (!cancelled) setError(err)
        })

        await db.connect("mem://")
        if (cancelled) {
          await db.close()
          return
        }

        // Set up namespace and database
        await db.query(`DEFINE NAMESPACE IF NOT EXISTS ${NAMESPACE}`)
        await db.use({ namespace: NAMESPACE })
        await db.query(`DEFINE DATABASE IF NOT EXISTS ${DATABASE}`)
        await db.use({ namespace: NAMESPACE, database: DATABASE })

        // Apply demo schema (same tables/fields as production, FULL permissions)
        await db.query(DEMO_SCHEMA)
        if (cancelled) {
          await db.close()
          return
        }

        dbRef.current = db

        // Start demo event generator
        const generator = new DemoEventGenerator(db)
        generatorRef.current = generator
        generator.start()

        setLoadingStage("ready")
        setReady(true)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
        }
      }
    }

    initDemo()

    return () => {
      cancelled = true
      generatorRef.current?.stop()
      generatorRef.current = null
      dbRef.current?.close()
      dbRef.current = null
    }
  }, [])

  const contextValue = useMemo<SurrealDBContextValue | null>(
    () =>
      dbRef.current
        ? {
            db: dbRef.current,
            status,
            ingestionStatus: "disabled" as IngestionStatus,
            error,
            appConfig: null,
          }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, error, ready],
  )

  if (!ready || !contextValue) {
    return <DemoLoadingScreen stage={loadingStage} error={error} />
  }

  return <SurrealDBContext.Provider value={contextValue}>{children}</SurrealDBContext.Provider>
}

// --- Loading screens ---

const RemoteLoadingScreen = ({ status, error }: { status?: ConnectionStatus; error?: Error | null }) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const showDemoSuggestion = elapsedSeconds >= 12 && status !== "connected"

  useEffect(() => {
    const timer = setInterval(() => setElapsedSeconds((prev) => prev + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  const statusLabel: Record<ConnectionStatus, string> = {
    connected: "Connected",
    connecting: "Connecting...",
    reconnecting: "Reconnecting...",
    disconnected: "Waiting for connection...",
  }

  return (
    <div
      data-testid="app-connection-loading"
      className="min-h-screen flex items-center justify-center bg-background text-foreground"
    >
      <div className="w-full max-w-md text-center space-y-4 px-6">
        <div className="text-lg font-medium">{status ? statusLabel[status] : "Starting..."}</div>
        <div className="text-sm text-muted-foreground">Connecting to observations ({elapsedSeconds}s)</div>
        <Progress className="h-2" value={status === "reconnecting" ? 35 : 65} />
        {elapsedSeconds >= 8 && !error && (
          <div className="text-xs text-muted-foreground">
            This is taking longer than expected. Services may still be warming up.
          </div>
        )}
        {showDemoSuggestion && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              If you just want to explore the app, switch to demo mode and use sample data instead.
            </div>
            <Button variant="outline" onClick={() => useSettingsStore.setState({ demo: true })}>
              Switch to demo mode
            </Button>
          </div>
        )}
        {error && <div className="text-sm text-destructive">Connection error: {error.message}</div>}
      </div>
    </div>
  )
}

const STAGE_PROGRESS: Record<DemoLoadingStage, number> = {
  downloading: 30,
  initializing: 70,
  ready: 100,
}

const STAGE_LABELS: Record<DemoLoadingStage, string> = {
  downloading: "Loading database engine...",
  initializing: "Initializing demo database...",
  ready: "Ready!",
}

const DemoLoadingScreen = ({ stage, error }: { stage: DemoLoadingStage; error: Error | null }) => (
  <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
    <div className="w-full max-w-sm text-center space-y-4">
      <div>
        <div className="text-lg font-medium">Demo Mode</div>
        <div className="text-sm text-muted-foreground mt-1">{STAGE_LABELS[stage]}</div>
      </div>
      <Progress value={STAGE_PROGRESS[stage]} className="h-2" />
      {error && <div className="text-sm text-destructive mt-2">Error: {error.message}</div>}
    </div>
  </div>
)

export default SurrealDBProvider
