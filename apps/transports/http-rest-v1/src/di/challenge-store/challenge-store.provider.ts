import { injectable } from "inversify"

import type { IChallengeStore, StoredChallenge } from "./types.js"

@injectable()
export class ChallengeStoreProvider implements IChallengeStore {
    private readonly store = new Map<string, StoredChallenge>()

    private prune(): void {
        const now = Date.now()

        for (const [nonce, row] of this.store) {
            if (row.expiresAtMs <= now) {
                this.store.delete(nonce)
            }
        }
    }

    public rememberChallenge(
        nonce: string,
        difficultyBits: number,
        expiresAtIso: string,
    ): void {
        this.prune()

        const expiresAtMs = Date.parse(expiresAtIso)

        if (Number.isNaN(expiresAtMs)) {
            throw new Error("invalid expiresAt")
        }

        this.store.set(nonce, { difficultyBits, expiresAtMs })
    }

    public takeChallenge(nonce: string): StoredChallenge | null {
        this.prune()

        const row = this.store.get(nonce)

        if (!row) {
            return null
        }

        if (row.expiresAtMs <= Date.now()) {
            this.store.delete(nonce)

            return null
        }

        this.store.delete(nonce)

        return row
    }
}
