import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { Surreal, type ConnectionStatus } from "surrealdb"
import useSettingsStore from "@stores/use-settings-store"
import { Progress } from "@components/ui/progress"
import { DEMO_SCHEMA } from "@lib/demo-schema"
import { DemoEventGenerator } from "@lib/demo-event-generator"

export type IngestionStatus = "leader" | "standby" | "read-only" | "disabled"

interface AppConfig {
    authRequired: boolean
    surrealPath: string
    ingestionStatus: IngestionStatus
    /** Viewer credentials for anonymous mode (SurrealDB v2 requires authentication) */
    viewerUser?: string
    viewerPass?: string
    viewerNs?: string
    viewerDb?: string
}

interface SurrealDBContextValue {
    db: Surreal
    status: ConnectionStatus
    ingestionStatus: IngestionStatus
    error: Error | null
}

const SurrealDBContext = createContext<SurrealDBContextValue | null>(null)

export const useSurrealDB = (): SurrealDBContextValue => {
    const ctx = useContext(SurrealDBContext)
    if (!ctx) throw new Error("useSurrealDB must be used within SurrealDBProvider")
    return ctx
}

const SESSION_TOKEN_KEY = "surrealdb_token"
const NAMESPACE = "celery_insights"
const DATABASE = "main"

async function fetchConfig(): Promise<AppConfig> {
    const res = await fetch("/api/config")
    if (!res.ok) throw new Error(`Failed to fetch config: ${res.status}`)
    return res.json()
}

async function connectAsViewer(
    db: Surreal,
    surrealPath: string,
    ns: string,
    database: string,
    viewerUser?: string,
    viewerPass?: string,
): Promise<void> {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const url = `${protocol}//${window.location.host}${surrealPath}`

    if (!viewerUser || !viewerPass) {
        console.warn("No viewer credentials provided — SurrealDB v2 requires authentication for all queries")
    }

    await db.connect(url, {
        namespace: ns,
        database,
        // SurrealDB v2 requires authentication — anonymous connections cannot query anything.
        // Authenticate as the read-only viewer DB user when credentials are provided.
        ...(viewerUser && viewerPass
            ? {
                  authentication: {
                      namespace: ns,
                      database,
                      username: viewerUser,
                      password: viewerPass,
                  },
              }
            : {}),
    })
}

async function connectWithToken(
    db: Surreal,
    surrealPath: string,
    ns: string,
    database: string,
    token: string,
): Promise<void> {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const url = `${protocol}//${window.location.host}${surrealPath}`
    await db.connect(url, { namespace: ns, database })
    await db.authenticate(token)
}

async function signIn(db: Surreal, surrealPath: string, ns: string, database: string, password: string) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const url = `${protocol}//${window.location.host}${surrealPath}`
    await db.connect(url, { namespace: ns, database })
    const tokens = await db.signin({
        namespace: ns,
        database,
        access: "frontend",
        variables: { name: "frontend", pass: password },
    })
    sessionStorage.setItem(SESSION_TOKEN_KEY, tokens.access)
}

interface SurrealDBProviderProps {
    children: React.ReactNode
}

const SurrealDBProvider = ({ children }: SurrealDBProviderProps) => {
    const isDemo = useSettingsStore((state) => state.demo)

    if (isDemo) {
        return <DemoSurrealDBProvider>{children}</DemoSurrealDBProvider>
    }

    return <RemoteSurrealDBProvider>{children}</RemoteSurrealDBProvider>
}

// --- Remote (production) provider ---

const RemoteSurrealDBProvider = ({ children }: { children: React.ReactNode }) => {
    const dbRef = useRef<Surreal>(new Surreal())
    const [status, setStatus] = useState<ConnectionStatus>("disconnected")
    const [hasConnectedOnce, setHasConnectedOnce] = useState(false)
    const [ingestionStatus, setIngestionStatus] = useState<IngestionStatus>("disabled")
    const [error, setError] = useState<Error | null>(null)
    const [authRequired, setAuthRequired] = useState<boolean | null>(null)
    const [authenticated, setAuthenticated] = useState(false)
    const [loginError, setLoginError] = useState<string | null>(null)
    const [loginLoading, setLoginLoading] = useState(false)
    const [configLoaded, setConfigLoaded] = useState(false)
    const configRef = useRef<AppConfig | null>(null)

    // Subscribe to connection status events
    useEffect(() => {
        const db = dbRef.current
        const unsubs = [
            db.subscribe("connecting", () => setStatus("connecting")),
            db.subscribe("connected", () => {
                setStatus("connected")
                setHasConnectedOnce(true)
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

    // Fetch config on mount. In dev mode (Vite dev server without Bun entry),
    // /api/config may not exist — fall back to anonymous mode with default surreal path.
    useEffect(() => {
        fetchConfig()
            .then((config) => {
                configRef.current = config
                setIngestionStatus(config.ingestionStatus)
                setAuthRequired(config.authRequired)
                setConfigLoaded(true)
            })
            .catch(() => {
                const fallback: AppConfig = {
                    authRequired: false,
                    surrealPath: "/surreal/rpc",
                    ingestionStatus: "disabled",
                    // Dev mode fallback: use default viewer credentials matching the schema migration defaults
                    viewerUser: "viewer",
                    viewerPass: "viewer",
                    viewerNs: NAMESPACE,
                    viewerDb: DATABASE,
                }
                configRef.current = fallback
                setIngestionStatus(fallback.ingestionStatus)
                setConfigLoaded(true)
            })
    }, [])

    // Auto-connect once config is loaded (anonymous or with existing token)
    useEffect(() => {
        if (!configLoaded || !configRef.current) return
        const config = configRef.current

        if (!config.authRequired) {
            // Anonymous mode — connect as read-only viewer user
            connectAsViewer(
                dbRef.current,
                config.surrealPath,
                config.viewerNs ?? NAMESPACE,
                config.viewerDb ?? DATABASE,
                config.viewerUser,
                config.viewerPass,
            )
                .then(() => setAuthenticated(true))
                .catch((err) => setError(err instanceof Error ? err : new Error(String(err))))
        } else {
            // Auth required — check for existing token in sessionStorage
            const token = sessionStorage.getItem(SESSION_TOKEN_KEY)
            if (token) {
                connectWithToken(dbRef.current, config.surrealPath, NAMESPACE, DATABASE, token)
                    .then(() => setAuthenticated(true))
                    .catch(() => {
                        // Token expired or invalid — show login dialog
                        sessionStorage.removeItem(SESSION_TOKEN_KEY)
                        dbRef.current.close()
                    })
            }
            // If no token, the login dialog will be shown
        }
    }, [configLoaded])

    // Login handler for the login dialog
    const handleLogin = useCallback(async (password: string) => {
        if (!configRef.current) return
        setLoginLoading(true)
        setLoginError(null)
        try {
            // Close any existing connection before signing in
            if (dbRef.current.isConnected) {
                await dbRef.current.close()
            }
            await signIn(dbRef.current, configRef.current.surrealPath, NAMESPACE, DATABASE, password)
            setAuthenticated(true)
        } catch {
            setLoginError("Invalid password")
            try {
                await dbRef.current.close()
            } catch {
                // ignore close errors
            }
        } finally {
            setLoginLoading(false)
        }
    }, [])

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
        }),
        [status, ingestionStatus, error],
    )

    // Loading state while fetching config
    if (!configLoaded) {
        return <RemoteLoadingScreen />
    }

    // Auth required and not authenticated — show login dialog
    if (authRequired && !authenticated) {
        return <LoginDialog onLogin={handleLogin} error={loginError} loading={loginLoading} />
    }

    // Block initial app render until first successful database connection.
    // This avoids route-level flicker and gives users a single clear loading state.
    if (!hasConnectedOnce) {
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
                <div className="text-sm text-muted-foreground">
                    Initializing SurrealDB connection ({elapsedSeconds}s)
                </div>
                <Progress className="h-2" value={status === "reconnecting" ? 35 : 65} />
                {elapsedSeconds >= 8 && !error && (
                    <div className="text-xs text-muted-foreground">
                        This is taking longer than expected. Services may still be warming up.
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

// --- Login dialog ---

interface LoginDialogProps {
    onLogin: (password: string) => void
    error: string | null
    loading: boolean
}

const LoginDialog = ({ onLogin, error, loading }: LoginDialogProps) => {
    const [password, setPassword] = useState("")

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (password.trim()) {
            onLogin(password)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
            <div className="w-full max-w-sm p-6 border rounded-lg shadow-lg bg-card">
                <div className="text-center mb-6">
                    <h1 className="text-xl font-semibold">Celery Insights</h1>
                    <p className="text-sm text-muted-foreground mt-1">Enter password to continue</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password"
                            // eslint-disable-next-line jsx-a11y/no-autofocus
                            autoFocus
                            disabled={loading}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                        />
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <button
                        type="submit"
                        disabled={loading || !password.trim()}
                        className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
                    >
                        {loading ? "Signing in..." : "Sign in"}
                    </button>
                </form>
            </div>
        </div>
    )
}

export default SurrealDBProvider
