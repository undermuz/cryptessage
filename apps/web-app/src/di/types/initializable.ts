export interface Initializable<R = void, A extends unknown[] = unknown[]> {
    initialize(...args: A): Promise<R>
}
