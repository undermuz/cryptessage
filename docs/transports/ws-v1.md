# Transport `ws_v1`

Duplex **binary** channel over **WSS**. Applies [security.md](security.md).

## Config shape (client)

```json
{
  "url": "wss://example.com/<deployment_secret>/v1/ws",
  "bearerToken": "<optional>",
  "protocols": [ "cryptessage-ws-v1" ],
  "pingIntervalMs": 30000
}
```

## Connection

1. Obtain PoW solution for `GET …/challenge` (same host/prefix as HTTP spec).
2. Connect WebSocket with:
   - Subprotocol: `cryptessage-ws-v1` (recommended) or documented alternative.
   - First frame **after** `onopen` MUST be a **UTF-8 text** “auth” JSON frame:

```json
{
  "type": "auth",
  "pow": "<base64url proof>",
  "bearer": "<optional>"
}
```

Server responds with text frame:

```json
{ "type": "auth_ok" }
```

or closes with **policy violation** code if auth fails.

## Framing

After `auth_ok`, all frames are **binary** (`Blob`/`ArrayBuffer` in browser):

- One WebSocket binary message = **one** transport frame (opaque bytes for the crypto layer).
- Max frame size **1 MiB** unless negotiated otherwise.

## Server push

Server may send binary frames at any time after auth; client treats each as one incoming ciphertext blob.

## Heartbeat

Either side may send **Ping** control frames; clients should reconnect with exponential backoff on disconnect.

## Error behavior

- Auth failure: close code **4401** (application-specific) or standard **1008** with reason.
- Rate limit: close **4429**; client backs off.

## Security notes

- Do not echo PoW or bearer tokens in close reasons.
- Combine with TLS and secret path; do not disable TLS in production.
