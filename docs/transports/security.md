# Shared security: secret path and proof-of-work

These rules apply to **all** remote transport implementations (`http_rest_v1`, `ws_v1`, WebRTC signaling, etc.) unless a spec explicitly narrows them.

## 1. Secret path (deployment secret)

### Goal

Avoid wide discovery and trivial scraping: only clients that received the full URL (out-of-band) may reach the API.

### Format

- All HTTPS/WSS endpoints are under a **high-entropy path prefix**  
  `https://example.com/<deployment_secret>/v1/...`  
  where `<deployment_secret>` is a random string (recommended: ≥ 32 bytes, base64url or hex-encoded), generated once per deployment.

### Rules for operators

- Do **not** put the secret in query strings that appear in shared referrers or CDN analytics.
- Terminate TLS at the edge; prefer **TLS 1.2+**.
- Rate-limit and monitor **per IP** and **per successful challenge** (see below).

### Rules for client implementers

- Store transports with a **`baseUrl` whose path ends with `/<deployment_secret>/v1`** (optional trailing slash), for example `https://example.com/a8f3…/v1`.
- To compute PoW, implementations take **`deployment_secret` as the single path segment immediately before the final `v1` segment** (same string as generated for the deployment, not percent-encoded unless it was encoded in the path).
- Never send the secret in `Referer` headers (avoid embedding secrets in web pages that link out).

## 2. Proof-of-work (`sha256-pow-v1`)

### Goal

Raise the cost of **automated** abuse before expensive work (storage, relay, DB writes). PoW is **not** authentication and **not** a substitute for TLS or access control.

### Challenge

`GET <secret_prefix>/v1/challenge` returns JSON:

```json
{
  "algorithm": "sha256-pow-v1",
  "nonce": "<base64url>",
  "difficultyBits": 18,
  "expiresAt": "2026-04-09T19:00:00Z"
}
```

### Solution

Client must find integer `counter` (64-bit unsigned, big-endian as 8 bytes in the hash input) such that:

`SHA256( nonceBytes ‖ utf8(deployment_secret) ‖ u64be(counter) )`

has at least `difficultyBits` leading zero bits (big-endian bit order of the digest — MSB of `digest[0]` first).

- `nonceBytes`: decode the challenge `nonce` field from **base64url** to raw bytes (same field returned in JSON).
- `deployment_secret`: UTF-8 bytes of the path segment (see §1).
- Encode the proof as JSON (field `counter` as a decimal string or JSON number) then **base64url** (standard base64 with `+`/`/` → `-`/`_`, padding stripped):

```json
{
  "algorithm": "sha256-pow-v1",
  "nonce": "<same string as in challenge>",
  "counter": "123456789"
}
```

Header on subsequent requests:

`X-Cryptessage-Pow: <base64url of utf8(JSON)>`

### Local / dev mode (unsafe)

For **localhost only**, a server MAY accept requests **without** `X-Cryptessage-Pow` when `SKIP_POW=true` (or equivalent). This must **never** be enabled on a public deployment. Reference servers document this explicitly.

Servers **should** bind PoW to a short-lived session token after first verify to avoid replay (optional in minimal servers).

### Shared secret (bearer or HMAC) — optional layer

In addition to the path secret, deployments may require:

`Authorization: Bearer <shared_token>`

documented per transport. Servers should reject missing/invalid tokens with **401** before running expensive handlers.

## 3. Error semantics

- **401** — secret path wrong, bearer wrong, or challenge missing/invalid.
- **429** — rate limited (retry with backoff).
- **400** — malformed payload or proof.

## 4. Privacy

Proofs and challenges must not embed plaintext message content or key material.
