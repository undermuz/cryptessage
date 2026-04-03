import { injectable } from "inversify"

import type {
    ITimersProvider,
    TimersCallback,
    TimersIntervalConfig,
} from "./types"

@injectable()
export class TimersClass<T = string> implements ITimersProvider<T> {
    public readonly timers: Map<T | string, number> = new Map()
    public readonly intervals: Map<T | string, number> = new Map()

    public has(name: T | string): boolean {
        return this.timers.has(name) || this.intervals.has(name)
    }

    public clear(name: T | string | T[] | string[] | null = null) {
        if (name !== null) {
            this.clearTimeout(name)
            this.clearInterval(name)

            return
        }

        this.timers.forEach((timer) => clearTimeout(timer))
        this.intervals.forEach((timer) => clearInterval(timer))

        this.timers.clear()
        this.intervals.clear()
    }

    public timeout<TArgs extends any[] = any[]>(
        callback: TimersCallback<TArgs>,
        time: number,
    ): string
    public timeout<TArgs extends any[] = any[]>(
        name: T,
        callback: TimersCallback<TArgs>,
        time: number,
    ): T
    public timeout<TArgs extends any[] = any[]>(
        arg1: TimersCallback<TArgs> | T | string,
        arg2: TimersCallback<TArgs> | number,
        arg3?: number,
    ): T | string {
        let callback: TimersCallback<TArgs>
        let time: number
        let name: string | null = null

        if (typeof arg1 === "function") {
            callback = arg1 as TimersCallback<TArgs>
            time = arg2 as number
        } else {
            name = arg1 as string
            callback = arg2 as TimersCallback<TArgs>
            time = arg3 as number
        }

        if (name) {
            this.clearTimeout(name)
        }

        const timer = +setTimeout((...args: any[]) => {
            const id = name || timer.toString()

            try {
                this.clearTimeout(id)
            } finally {
                // @ts-ignore
                callback.apply(null, ...args)
            }
        }, time)

        const id = name || timer.toString()

        this.timers.set(id, timer)

        return id
    }

    public interval<TArgs extends any[] = any[]>(
        callback: TimersCallback<TArgs>,
        time: number,
    ): string
    public interval<TArgs extends any[] = any[]>(
        name: T,
        callback: TimersCallback<TArgs>,
        time: TimersIntervalConfig,
    ): T
    public interval<TArgs extends any[] = any[]>(
        arg1: TimersCallback<TArgs> | T | string,
        arg2: TimersCallback<TArgs> | TimersIntervalConfig,
        arg3?: TimersIntervalConfig,
    ): T | string {
        let callback: TimersCallback<TArgs>
        let time: number
        let name: string | null = null
        let config: TimersIntervalConfig
        let immediate = false

        if (typeof arg1 === "function") {
            callback = arg1 as TimersCallback<TArgs>
            config = arg2 as TimersIntervalConfig
        } else {
            name = arg1 as string
            callback = arg2 as TimersCallback<TArgs>
            config = arg3 as TimersIntervalConfig
        }

        if (typeof config === "number") {
            time = config as number
        } else {
            time = config.interval
            immediate = Boolean(config.immediate)
        }

        if (name) {
            this.clearInterval(name)
        }

        const timer = +setInterval(callback, time)

        const id = name || timer.toString()

        this.intervals.set(id, timer)

        if (immediate) {
            Promise.resolve().then(() => callback(...([] as unknown as TArgs)))
        }

        return id
    }

    public clearTimeout(id: T | string | T[] | string[]) {
        if (Array.isArray(id)) {
            id.forEach((id) => this.clearTimeout(id))

            return
        }

        const exists = this.timers.get(id)

        if (!exists) {
            return
        }

        clearTimeout(exists)

        this.timers.delete(id)
    }

    public clearInterval(id: T | string | T[] | string[]) {
        if (Array.isArray(id)) {
            id.forEach((id) => this.clearInterval(id))

            return
        }

        const exists = this.intervals.get(id)

        if (!exists) {
            return
        }

        clearInterval(exists)

        this.intervals.delete(id)
    }
}
