export const InMemoryService = Symbol.for(
    "@cryptessage/http-rest-v1:InMemoryService",
)

export type OutboxPage = {
    messages: Buffer[]
    lastSeqInPage: number | null
    hasMore: boolean
}

export type IInMemoryService = {
    pushMessage(recipientKeyId: string, body: Buffer): number
    listOutboxAfter(
        recipientKeyId: string,
        afterSeq: number,
        limit: number,
    ): OutboxPage
}
