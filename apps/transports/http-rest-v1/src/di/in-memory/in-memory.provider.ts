import { injectable } from "inversify"

import type { IInMemoryService, OutboxPage } from "./types.js"

type StoredMsg = { seq: number; body: Buffer }

const MAX_MESSAGES_PER_RECIPIENT = 1000

@injectable()
export class InMemoryProvider implements IInMemoryService {
    private readonly queues = new Map<string, StoredMsg[]>()

    private readonly nextSeq = new Map<string, number>()

    private bumpSeq(recipientKeyId: string): number {
        const n = (this.nextSeq.get(recipientKeyId) ?? 0) + 1

        this.nextSeq.set(recipientKeyId, n)

        return n
    }

    public pushMessage(recipientKeyId: string, body: Buffer): number {
        const copy = Buffer.from(body)
        const seq = this.bumpSeq(recipientKeyId)
        const list = this.queues.get(recipientKeyId) ?? []

        list.push({ seq, body: copy })

        while (list.length > MAX_MESSAGES_PER_RECIPIENT) {
            list.shift()
        }

        this.queues.set(recipientKeyId, list)

        return seq
    }

    public listOutboxAfter(
        recipientKeyId: string,
        afterSeq: number,
        limit: number,
    ): OutboxPage {
        const list = this.queues.get(recipientKeyId) ?? []
        const out: Buffer[] = []
        let last: number | null = null

        for (const row of list) {
            if (row.seq <= afterSeq) {
                continue
            }

            out.push(row.body)
            last = row.seq

            if (out.length >= limit) {
                const lastSeq = last!
                const hasMore = list.some((r) => r.seq > lastSeq)

                return {
                    messages: out,
                    lastSeqInPage: lastSeq,
                    hasMore,
                }
            }
        }

        return { messages: out, lastSeqInPage: last, hasMore: false }
    }
}
