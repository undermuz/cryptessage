import type { ILogger } from "../types/logger"

export type LogLevels =
    | "trace"
    | "debug"
    | "info"
    | "warning"
    | "error"
    | "fatal"

export type ILoggerSettings = Record<string, unknown>

export type ILoggerFactory = <T = ILoggerSettings>(
    name: string,
    settings?: T,
) => ILogger
