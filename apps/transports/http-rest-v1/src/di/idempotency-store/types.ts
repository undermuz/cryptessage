export const IdempotencyStore = Symbol.for(
    "@cryptessage/http-rest-v1:IdempotencyStore",
)

export type IIdempotencyStore = {
    hasKey(key: string): boolean
    rememberKey(key: string): void
}
