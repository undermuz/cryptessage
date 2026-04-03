export interface PersistState<T = unknown> {
    loadState(): Promise<T | null>
    saveState(state: T): Promise<void>
}
