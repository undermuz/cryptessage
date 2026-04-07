export type TimersCallback<TArgs extends any[]> = (...args: TArgs) => void

export type TimersIntervalConfig =
    | number
    | {
        interval: number
        immediate?: boolean
    }

export const TimersProvider = Symbol.for("TimersProvider")

export type ITimersProvider<T = string> = {
    readonly timers: Map<T | string, number>
    readonly intervals: Map<T | string, number>

    has(name: T | string): boolean

    clear(name: T | string | T[] | string[] | null): void
    clearTimeout(id: T | string | T[] | string[]): void
    clearInterval(id: T | string | T[] | string[]): void

    timeout<TArgs extends any[] = any[]>(
        callback: TimersCallback<TArgs>,
        time: number,
    ): string
    timeout<TArgs extends any[] = any[]>(
        name: T,
        callback: TimersCallback<TArgs>,
        time: number,
    ): T
    timeout<TArgs extends any[] = any[]>(
        arg1: TimersCallback<TArgs> | string,
        arg2: TimersCallback<TArgs> | number,
        arg3?: number,
    ): T | string

    interval<TArgs extends any[] = any[]>(
        callback: TimersCallback<TArgs>,
        time: number,
    ): string
    interval<TArgs extends any[] = any[]>(
        name: T,
        callback: TimersCallback<TArgs>,
        time: TimersIntervalConfig,
    ): T
    interval<TArgs extends any[] = any[]>(
        arg1: TimersCallback<TArgs> | string,
        arg2: TimersCallback<TArgs> | TimersIntervalConfig,
        arg3?: TimersIntervalConfig,
    ): T | string
}
