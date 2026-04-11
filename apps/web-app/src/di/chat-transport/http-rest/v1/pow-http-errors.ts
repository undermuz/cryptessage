/** Reads `{ error: string }` from a 401 body without consuming `res` for other handlers. */
export async function readUnauthorizedErrorCode(
    res: Response,
): Promise<string | undefined> {
    if (res.status !== 401) {
        return undefined
    }

    try {
        const j = (await res.clone().json()) as { error?: unknown }

        return typeof j.error === "string" ? j.error : undefined
    } catch {
        return undefined
    }
}
