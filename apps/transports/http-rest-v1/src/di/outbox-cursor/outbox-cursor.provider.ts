import { BadRequestHttpResponse } from "@inversifyjs/http-core"
import { injectable } from "inversify"

import type { IOutboxCursor, OutboxCursorPayload } from "./types.js"

@injectable()
export class OutboxCursorProvider implements IOutboxCursor {
    public encode(lastSeqExclusive: number): string {
        const json = JSON.stringify({
            v: 1,
            ls: lastSeqExclusive,
        } satisfies OutboxCursorPayload)

        return Buffer.from(json, "utf8")
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "")
    }

    public decode(
        since: string | undefined,
    ): number | BadRequestHttpResponse {
        if (since === undefined || since === "") {
            return 0
        }

        let b64 = since.trim()
        b64 = b64.replace(/-/g, "+").replace(/_/g, "/")
        const pad = b64.length % 4

        if (pad) {
            b64 += "=".repeat(4 - pad)
        }

        let json: string

        try {
            json = Buffer.from(b64, "base64").toString("utf8")
        } catch {
            return new BadRequestHttpResponse({ error: "invalid_cursor" })
        }

        try {
            const o = JSON.parse(json) as unknown

            if (
                typeof o !== "object" ||
                o === null ||
                !("v" in o) ||
                !("ls" in o)
            ) {
                return new BadRequestHttpResponse({ error: "invalid_cursor" })
            }

            const p = o as Record<string, unknown>

            if (p.v !== 1 || typeof p.ls !== "number" || !Number.isFinite(p.ls)) {
                return new BadRequestHttpResponse({ error: "invalid_cursor" })
            }

            if (p.ls < 0) {
                return new BadRequestHttpResponse({ error: "invalid_cursor" })
            }

            return p.ls
        } catch {
            return new BadRequestHttpResponse({ error: "invalid_cursor" })
        }
    }
}
