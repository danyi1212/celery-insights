import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { Surreal, type ConnectionStatus } from "surrealdb"

export type IngestionStatus = "leader" | "standby" | "read-only" | "disabled"

interface AppConfig {
    authRequired: boolean
    surrealPath: string
    ingestionStatus: IngestionStatus
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

async function fetchConfig(): Promise<AppConfig> {
    const res = await fetch("/api/config")
    if (!res.ok) throw new Error(`Failed to fetch config: ${res.status}`)
    return res.json()
}

async function connectAnonymous(db: Surreal, surrealPath: string, ns: string, database: string): Promise<void> {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const url = `${protocol}//${window.location.host}${surrealPath}`
    await db.connect(url, { namespace: ns, database })
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

const NAMESPACE = "celery_insights"
const DATABASE = "main"

interface SurrealDBProviderProps {
    children: React.ReactNode
}

const SurrealDBProvider = ({ children }: SurrealDBProviderProps) => {
    const dbRef = useRef<Surreal>(new Surreal())
    const [status, setStatus] = useState<ConnectionStatus>("disconnected")
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

    // Fetch config on mount
    useEffect(() => {
        fetchConfig()
            .then((config) => {
                configRef.current = config
                setIngestionStatus(config.ingestionStatus)
                setAuthRequired(config.authRequired)
                setConfigLoaded(true)
            })
            .catch((err) => {
                setError(err instanceof Error ? err : new Error(String(err)))
                setConfigLoaded(true)
            })
    }, [])

    // Auto-connect once config is loaded (anonymous or with existing token)
    useEffect(() => {
        if (!configLoaded || !configRef.current) return
        const config = configRef.current

        if (!config.authRequired) {
            // Anonymous mode — connect immediately
            connectAnonymous(dbRef.current, config.surrealPath, NAMESPACE, DATABASE)
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
        return <SurrealDBLoadingScreen />
    }

    // Auth required and not authenticated — show login dialog
    if (authRequired && !authenticated) {
        return <LoginDialog onLogin={handleLogin} error={loginError} loading={loginLoading} />
    }

    return <SurrealDBContext.Provider value={contextValue}>{children}</SurrealDBContext.Provider>
}

const SurrealDBLoadingScreen = () => (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
            <div className="text-lg font-medium">Connecting...</div>
            <div className="text-sm text-muted-foreground mt-1">Initializing database connection</div>
        </div>
    </div>
)

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
