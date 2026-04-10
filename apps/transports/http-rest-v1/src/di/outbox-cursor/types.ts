import type { BadRequestHttpResponse } from "@inversifyjs/http-core"

export const OutboxCursor = Symbol.for(
    "@cryptessage/http-rest-v1:OutboxCursor",
)

export type OutboxCursorPayload = { v: 1; ls: number }

export type IOutboxCursor = {
    encode(lastSeqExclusive: number): string
    decode(
        since: string | undefined,
    ): number | BadRequestHttpResponse
}
