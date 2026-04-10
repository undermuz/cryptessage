# Cryptessage remote transports

This folder specifies **network transports** for moving **opaque binary payloads** between clients. Transports **do not interpret ciphertext**: the app encrypts plaintext first; the transport moves `Uint8Array` frames only.

Client implementation (registration, UI panels, prefs) lives under `apps/web-app/src/di/chat-transport` and `apps/web-app/src/views/widgets/chat-transport`.

## Documents

| Spec | Description |
| --- | --- |
| [security.md](security.md) | Shared **secret path** (deployment prefix) and **proof-of-work** challenge for rate limiting / cheap DDoS mitigation |
| [http-rest-v1.md](http-rest-v1.md) | HTTPS inbox/outbox REST API |
| [ws-v1.md](ws-v1.md) | WebSocket binary duplex |
| [webrtc-datachannel-v1.md](webrtc-datachannel-v1.md) | WebRTC data channel + signaling assumptions |

## Transport kinds (versioned strings)

Kinds are lowercase slugs with a version suffix, e.g. `http_rest_v1`, `ws_v1`, `webrtc_datachannel_v1`. The offline built-in channel is `qr_text`.

## Metadata (not secrets)

Transports may receive **routing metadata** (contact id, crypto protocol, public key fingerprints/material for addressing). They **must not** log passphrases, private keys, or full ciphertext to client or server logs in production.
