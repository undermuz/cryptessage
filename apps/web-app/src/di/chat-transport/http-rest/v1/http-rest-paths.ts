/** Replace `{recipientKeyId}` in template with URL-encoded id. */
export function expandInboxPath(
    template: string,
    recipientKeyId: string,
): string {
    if (!template.includes("{recipientKeyId}")) {
        throw new Error(
            "http_rest_v1: inboxPathTemplate must contain {recipientKeyId}",
        )
    }

    const safe = encodeURIComponent(recipientKeyId)

    return template.replace(/\{recipientKeyId\}/g, safe)
}

/** Replace `{selfKeyId}` in template with URL-encoded id. */
export function expandOutboxPath(template: string, selfKeyId: string): string {
    if (!template.includes("{selfKeyId}")) {
        throw new Error(
            "http_rest_v1: outboxPathTemplate must contain {selfKeyId}",
        )
    }

    const safe = encodeURIComponent(selfKeyId)

    return template.replace(/\{selfKeyId\}/g, safe)
}
