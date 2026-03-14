import { config } from "./config"

type LogLevel = "debug" | "info" | "warn" | "error"

const LEVEL_PRIORITY: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

const LEVEL_LABELS: Record<LogLevel, string> = {
    debug: "DEBUG",
    info: " INFO",
    warn: " WARN",
    error: "ERROR",
}

const ANSI = {
    reset: "\x1b[0m",
    dim: "\x1b[2m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    red: "\x1b[31m",
}

const LEVEL_COLORS: Record<LogLevel, string> = {
    debug: ANSI.cyan,
    info: ANSI.green,
    warn: ANSI.yellow,
    error: ANSI.red,
}

export interface Logger {
    debug(msg: string, extra?: Record<string, unknown>): void
    info(msg: string, extra?: Record<string, unknown>): void
    warn(msg: string, extra?: Record<string, unknown>): void
    error(msg: string, extra?: Record<string, unknown>): void
}

type LogSink = (line: string, level: LogLevel, extra?: Record<string, unknown>) => void

const serviceSinks = new Map<string, Set<LogSink>>()

export function registerLogSink(service: string, sink: LogSink): () => void {
    const sinks = serviceSinks.get(service) ?? new Set<LogSink>()
    sinks.add(sink)
    serviceSinks.set(service, sinks)
    return () => {
        const current = serviceSinks.get(service)
        if (!current) return
        current.delete(sink)
        if (current.size === 0) {
            serviceSinks.delete(service)
        }
    }
}

export function createLogger(service: string, format?: "pretty" | "json", level?: LogLevel): Logger {
    const fmt = format ?? config.logFormat
    const minLevel = level ?? config.logLevel
    const isTTY = process.stdout.isTTY === true
    const useColor = isTTY && fmt === "pretty"

    function emit(lvl: LogLevel, msg: string, extra?: Record<string, unknown>): void {
        if (LEVEL_PRIORITY[lvl] < LEVEL_PRIORITY[minLevel]) return

        const ts = new Date().toISOString()

        if (fmt === "json") {
            const obj: Record<string, unknown> = { ts, level: lvl, service, msg }
            if (extra) Object.assign(obj, extra)
            const stream = lvl === "error" || lvl === "warn" ? process.stderr : process.stdout
            const line = JSON.stringify(obj)
            stream.write(line + "\n")
            const sinks = serviceSinks.get(service)
            if (sinks) {
                for (const sink of sinks) {
                    sink(line, lvl, extra)
                }
            }
            return
        }

        const label = LEVEL_LABELS[lvl]
        let line: string
        if (useColor) {
            const color = LEVEL_COLORS[lvl]
            line = `${ANSI.dim}${ts}${ANSI.reset}  ${color}${label}${ANSI.reset}  ${ANSI.dim}[${service}]${ANSI.reset} ${msg}`
        } else {
            line = `${ts}  ${label}  [${service}] ${msg}`
        }

        const stream = lvl === "error" || lvl === "warn" ? process.stderr : process.stdout
        stream.write(line + "\n")
        const sinks = serviceSinks.get(service)
        if (sinks) {
            for (const sink of sinks) {
                sink(line, lvl, extra)
            }
        }
    }

    return {
        debug: (msg, extra?) => emit("debug", msg, extra),
        info: (msg, extra?) => emit("info", msg, extra),
        warn: (msg, extra?) => emit("warn", msg, extra),
        error: (msg, extra?) => emit("error", msg, extra),
    }
}

export const bunLogger = createLogger("bun")
export const surrealLogger = createLogger("surrealdb")
