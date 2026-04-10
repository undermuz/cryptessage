import { injectable } from "inversify"

import type { IIdempotencyStore } from "./types.js"

const TTL_MS = 24 * 60 * 60 * 1000

@injectable()
export class IdempotencyStoreProvider implements IIdempotencyStore {
    private readonly seen = new Map<string, number>()

    private prune(): void {
        const now = Date.now()

        for (const [k, exp] of this.seen) {
            if (exp <= now) {
                this.seen.delete(k)
            }
        }
    }

    public hasKey(key: string): boolean {
        this.prune()

        const exp = this.seen.get(key)

        if (exp === undefined) {
            return false
        }

        if (exp <= Date.now()) {
            this.seen.delete(key)

            return false
        }

        return true
    }

    public rememberKey(key: string): void {
        this.prune()
        this.seen.set(key, Date.now() + TTL_MS)
    }
}
