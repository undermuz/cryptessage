# Transport `http_rest_v1`

REST API over HTTPS for **posting** opaque binary messages to a recipient **inbox** and optionally **polling** an outbox. Applies [security.md](security.md) (secret path + PoW + optional bearer).

## Config shape (client)

```json
{
  "baseUrl": "https://example.com/<deployment_secret>/v1",
  "bearerToken": "<optional>",
  "inboxPathTemplate": "/inbox/{recipientKeyId}",
  "outboxSelfKeyId": "<optional opaque id for your outbox>",
  "outboxPathTemplate": "/outbox/{selfKeyId}",
  "pollIntervalMs": 10000,
  "timeoutMs": 15000,
  "skipPow": false
}
```

- **`baseUrl`**: no trailing slash required; must include `/<deployment_secret>/v1` as the path suffix. The cryptessage client derives PoW material from the segment before `v1` (see [security.md](security.md)).
- **`skipPow`**: if `true`, the client omits the PoW header. **Only allowed** when `baseUrl` uses hostname `localhost`, `127.0.0.1`, or `[::1]`, and the server runs with dev mode that skips verification (see security.md).
- **`outboxSelfKeyId`**: opaque id for **your** mailbox on this `baseUrl` (same meaning as `selfKeyId` in the outbox URL). When set, the client can poll `GET …/outbox/{selfKeyId}` and receive incoming frames. Omitted or empty disables HTTP polling for that profile.
- **`outboxPathTemplate`**: path template with `{selfKeyId}` (URL-encoded), default `"/outbox/{selfKeyId}"`, symmetric to `inboxPathTemplate`.
- **`pollIntervalMs`**: how often to poll when receiving is enabled; default `10000`, clamped to `1000`–`60000`.

`recipientKeyId` is an opaque routing token agreed out-of-band (e.g. truncated fingerprint, compact key id). **Not** the long-term private key.

## Endpoints

All requests MUST send:

- `X-Cryptessage-Pow` (see security.md), unless both client and server use the documented **local/dev** exception.
- `Authorization: Bearer …` if configured.

### Challenge

`GET {baseUrl}/challenge` → challenge JSON.

### Push message

`POST {baseUrl}/inbox/{recipientKeyId}`

- Headers: `Content-Type: application/octet-stream`
- Body: raw frame (one logical message = one request body, max size **1 MiB** unless server documents otherwise).

Responses:

| Code | Meaning |
| --- | --- |
| 202 | Accepted, queued or stored |
| 400 | Bad path or body |
| 401 | Auth / PoW failure |
| 413 | Body too large |
| 429 | Rate limited |

### Fetch (optional minimal spec)

`GET {baseUrl}/outbox/{selfKeyId}?since=<cursor>`  
Returns `application/octet-stream` batches or `application/json` envelope:

```json
{ "nextCursor": "…", "messages": [ "<base64>" ] }
```

Exact cursor format is implementation-defined; servers SHOULD use opaque cursors. Servers SHOULD return `nextCursor` after each page that delivered at least one message (including the last page when there is no further page), so clients can persist their position and avoid duplicates on the next poll.

## Idempotency

Optional header: `Idempotency-Key: <uuid>`. Servers MAY deduplicate posts with the same key within 24 hours.

## curl example

```bash
# 1. Obtain challenge (parse nonce + difficulty)
curl -sS "https://host/<secret>/v1/challenge"

# 2. Compute PoW off-line, then POST
curl -sS -X POST \
  -H "Content-Type: application/octet-stream" \
  -H "X-Cryptessage-Pow: <base64url>" \
  -H "Authorization: Bearer <token>" \
  --data-binary '@message.bin' \
  "https://host/<secret>/v1/inbox/recipientKeyIdHex"
```
