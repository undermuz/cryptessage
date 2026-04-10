/**
 * Parses the deployment secret segment from an `http_rest_v1` `baseUrl`.
 *
 * `baseUrl` must be `https://host/<deployment_secret>/v1` (optional trailing slash).
 * The deployment secret is the path segment immediately before `v1`.
 * @returns Opaque deployment secret string used in PoW preimage.
 * @throws If URL is invalid or path does not end with `…/<secret>/v1`.
 */
export function extractDeploymentSecretFromBaseUrl(baseUrl: string): string {
    let u: URL

    try {
        u = new URL(baseUrl)
    } catch {
        throw new Error("http_rest_v1: invalid baseUrl")
    }

    const parts = u.pathname.replace(/\/$/, "").split("/").filter(Boolean)
    const v1At = parts.lastIndexOf("v1")

    if (v1At <= 0) {
        throw new Error(
            "http_rest_v1: baseUrl path must end with /<deployment_secret>/v1",
        )
    }

    return parts[v1At - 1]!
}
