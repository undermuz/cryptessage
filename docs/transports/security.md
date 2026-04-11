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
  "expiresAt": "2026-04-09T19:00:00Z",
  "clientHints": {
    "powMode": "adaptive",
    "idleMsBeforePow": 1800000,
    "maxRps": 5,
    "maxRpm": 350
  }
}
```

`clientHints` is **optional** metadata for clients (ignored when computing the PoW preimage). When present, it describes the server’s default policy so the client can align local rate/idleness logic without hard-coding. Clients MAY override hints via transport profile JSON (see `http-rest-v1.md`).

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

Header on protected requests (inbox POST, outbox GET, etc.):

`X-Cryptessage-Pow: <base64url of utf8(JSON)>`

### Adaptive sessions (recommended)

To avoid solving PoW on every request, a server MAY run in **`adaptive`** mode (default in the reference `http-rest-v1` server):

1. The first successful request that presented a valid `X-Cryptessage-Pow` receives a signed **`X-Cryptessage-Session`** on the response.
2. Subsequent requests MAY send **`X-Cryptessage-Session`** instead of `X-Cryptessage-Pow` while the session is valid:
   - **Sliding idle**: if no request on that session for longer than `idleMsBeforePow` (default 30 minutes), the next request must present a fresh PoW again.
   - **Rate limits** (per session, server-enforced): rolling **1s** window `maxRps` (default 5) and rolling **60s** window `maxRpm` (default 350). Exceeding either invalidates the session; the client must obtain a new challenge and solve PoW again.
3. In **`always`** mode, the server does not issue sessions; every protected request must include `X-Cryptessage-Pow` (one challenge consumed per verified proof).

Session tokens are **opaque HMAC-signed blobs** (implementation-specific). Clients should treat them as bearer material for that deployment only.

Reference server environment variables (subset): `POW_MODE` (`adaptive`|`always`), `POW_IDLE_MS_BEFORE_POW`, `POW_MAX_RPS`, `POW_MAX_RPM`, `SESSION_HMAC_SECRET` (**required** for `adaptive` — must be a server-only random secret; never reuse the deployment path segment, which clients already know from `baseUrl`), `SESSION_MAX_TTL_MS`.

### Local / dev mode (unsafe)

For **localhost only**, a server MAY accept requests **without** `X-Cryptessage-Pow` when `SKIP_POW=true` (or equivalent). This must **never** be enabled on a public deployment. Reference servers document this explicitly.

### Shared secret (bearer or HMAC) — optional layer

In addition to the path secret, deployments may require:

`Authorization: Bearer <shared_token>`

documented per transport. Servers should reject missing/invalid tokens with **401** before running expensive handlers.

## 3. Error semantics

- **401** — secret path wrong, bearer wrong, PoW missing/invalid (`pow_required`, `pow_invalid`, `pow_challenge_invalid`), or session invalid/expired/rate-limited (`session_invalid`). JSON body typically `{ "error": "<code>" }`.
- **429** — rate limited (retry with backoff).
- **400** — malformed payload or proof.

## 4. Privacy

Proofs and challenges must not embed plaintext message content or key material.
