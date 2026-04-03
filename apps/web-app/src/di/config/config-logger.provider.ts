import { inject, injectable } from "inversify"

import { ConfigProvider } from "./types"

import { LogLevels } from "@/di/logger/types"

import {
    configure,
    getConsoleSink,
    type LogRecord,
    type Config as LogTapeConfig,
} from "@logtape/logtape"

// import { prettyFormatter } from "@logtape/pretty"

import { type AppConfig } from "./config.provider"

@injectable()
export class ConfigLoggerProvider {
    @inject(ConfigProvider)
    private readonly config: AppConfig

    protected logLevelStyles: Record<LogLevels, string> = {
        trace: "background-color: gray; color: white;",
        debug: "background-color: gray; color: white;",
        info: "background-color: blue; color: white;",
        warning: "background-color: orange; color: black;",
        error: "background-color: red; color: white;",
        fatal: "background-color: maroon; color: white;",
    }

    protected levelAbbreviations: Record<LogLevels, string> = {
        trace: "TRC",
        debug: "DBG",
        info: "INF",
        warning: "WRN",
        error: "ERR",
        fatal: "FTL",
    }

    protected entitiesStyles: Record<
        string,
        (level: LogLevels, value: string) => string
    > = {
        time: () => "color: gray;",
        category: (level: LogLevels, value: string) => {
            // if (level === "trace") {
            //     return "background-color: default;"
            // }

            // if (level === "debug") {
            //     return "background-color: gray;"
            // }

            if (value.indexOf("di") > -1) {
                return "background-color: default; color: magenta;"
            }

            return "background-color: default; color: GreenYellow;"
        },
        message: (level: LogLevels) => {
            if (level === "trace" || level === "debug") {
                return "color: gray;"
            }

            return "color: default;"
        },
        default: () => "color: default;",
    }

    protected consoleFormatter(record: LogRecord): readonly unknown[] {
        const { logLevelStyles, levelAbbreviations, entitiesStyles } = this

        let msg = ""

        const values: unknown[] = []

        //The number of elements in this array is always odd, with the message template values interleaved between the substitution values.
        for (let i = 0; i < record.message.length; i++) {
            if (i % 2 === 0) {
                msg += record.message[i]
            } else {
                msg += "%o"

                values.push(record.message[i])
            }
        }

        const date = new Date(record.timestamp)

        const hours = date.getUTCHours().toString().padStart(2, "0")
        const minutes = date.getUTCMinutes().toString().padStart(2, "0")
        const seconds = date.getUTCSeconds().toString().padStart(2, "0")
        const ms = date.getUTCMilliseconds().toString().padStart(3, "0")

        const time = `${hours}:${minutes}:${seconds}.${ms}`

        const category = `[${record.category.join("][")}]`
            .replaceAll("[[", "[")
            .replaceAll("]]", "]")

        const level = levelAbbreviations[record.level]
        const levelStyle = logLevelStyles[record.level]

        return [
            `%c${time} %c ${level} %c %c${category} %c${msg}`,
            entitiesStyles.time(record.level, time),
            levelStyle,
            entitiesStyles.default(record.level, ""),
            entitiesStyles.category(record.level, category),
            entitiesStyles.message(record.level, msg),
            ...values,
        ]
    }

    protected getLoggerConfig(): LogTapeConfig<string, string> {
        return {
            reset: true,
            sinks: {
                console: getConsoleSink({
                    formatter: this.consoleFormatter.bind(this),
                }),
            },
            loggers: [
                {
                    category: ["logtape", "meta"],
                    lowestLevel: "warning",
                    sinks: ["console"],
                },
                {
                    category: ["di"],
                    lowestLevel: this.config.logLevel,
                    sinks: ["console"],
                },
                {
                    category: ["react"],
                    lowestLevel: this.config.logLevel,
                    sinks: ["console"],
                },
            ],
        }
    }

    public async initialize() {
        await configure(this.getLoggerConfig())
    }
}
