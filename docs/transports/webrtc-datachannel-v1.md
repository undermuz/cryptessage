# Transport `webrtc_datachannel_v1`

Peer-to-peer **ordered binary** delivery using WebRTC **data channels**. Signaling is **out-of-band** over HTTPS/WSS using the same [security.md](security.md) model.

## Roles

- **Signal server**: exchanges SDP/ICE candidates between peers (minimal room semantics).
- **Peers**: run the cryptessage client; each side already has long-term public keys (out of scope here).

## Config shape (client)

```json
{
  "signalBaseUrl": "https://example.com/<deployment_secret>/v1",
  "bearerToken": "<optional>",
  "iceServers": [
    { "urls": "stun:stun.l.google.com:19302" },
    { "urls": "turn:turn.example.com:3478", "username": "u", "credential": "p" }
  ],
  "roomId": "<opaque room id>",
  "isInitiator": true
}
```

`iceServers` follows standard `RTCIceServer` arrays.

## Signaling HTTP (reference)

Actual paths are deployment-defined but SHOULD version under `/v1/`:

| Method | Path | Body | Purpose |
| --- | --- | --- | --- |
| POST | `/signal/rooms/{roomId}/offer` | SDP text | Initiator posts offer |
| GET | `/signal/rooms/{roomId}/offer` | — | Answerer fetches offer |
| POST | `/signal/rooms/{roomId}/answer` | SDP text | Answerer posts answer |
| POST | `/signal/rooms/{roomId}/ice` | JSON `{ candidate }` | Trickled ICE |

All signaling requests carry `X-Cryptessage-Pow` + optional bearer per security.md.

## Data channel

- Negotiate a **single** reliable ordered SCTP channel: `label: cryptessage`, `ordered: true`.
- Binary type: `arraybuffer`.
- One `send()` buffer = one opaque ciphertext frame (max **256 KiB** per chunk; app may chunk higher layers if needed).

## Security notes

- **DTLS-SRTP** covers integrity/confidentiality for the media plane; data channels inherit WebRTC stack security.
- **Identity binding** (who is the peer?) is out of scope: the cryptessage app layer already binds keys via contact keys / QR exchange.
- Signaling server **must not** log full SDP or ICE credentials at info level in production.

## Fallback

If ICE fails, clients SHOULD fall back to `http_rest_v1` / `qr_text` according to user settings.
