# cryptessage

Browser-based, **offline-first** messaging for hostile networks: you exchange **OpenPGP public keys in person** (QR or paste), then move **encrypted payloads** over any channel (messengers, email, even another phone’s camera via QR).

There are **no central servers** and **no cloud account**. A **passphrase** derives a master key (**PBKDF2**); **contacts, messages, and private keys** are stored in **IndexedDB** encrypted with **AES-GCM**. The passphrase is **never** persisted—only kept in memory for the session.

> **v0.1** ships as a normal **SPA** (Vite). PWA plumbing exists (manifest + service worker via VitePWA), but treat it as **work-in-progress**.

## Features

- **Unlock / create vault / restore backup** — one JSON backup file, encrypted with the same KDF + AES-GCM as the database (salt embedded in the file header).
- **Messaging crypto (2 protocols)** — `openpgp` (OpenPGP.js, encrypt+sign, decrypt+verify) and `compact_v1` (X25519 + XSalsa20-Poly1305 + Ed25519 signature).
- **QR** — visit cards (legacy JSON, or binary `CMV2`) and encrypted message blobs (binary QR wrappers `CMM1` / `CMK1`; length-limited — very long text may not fit a single QR).
- **TanStack Router** — typed routes with an auth guard: locked session redirects to `/unlock`.
- **InversifyJS** — crypto, storage, identity, backup, and conversation services are wired through DI (see `apps/web-app/src/di`).
- **HeroUI v3** — new/updated screens are implemented with HeroUI v3 components (see “UI migration status”).

## Stack

| Area        | Technology                                      |
| ----------- | ----------------------------------------------- |
| Monorepo    | Nx                                              |
| App         | React 19, Vite 8, TypeScript                    |
| UI          | Tailwind CSS 4, HeroUI v3 (`@heroui/react`, `@heroui/styles`) |
| Routing     | TanStack Router                                 |
| DI          | InversifyJS                                     |
| Crypto      | Web Crypto (PBKDF2, AES-GCM), OpenPGP.js        |
| QR          | `qrcode`, `@zxing/browser`                      |

## Repository layout

```
apps/web-app/     # cryptessage SPA (main application)
  src/app/        # shell, router, bootstrap
  src/di/         # services, Inversify modules, secure primitives
  src/views/      # UI widgets and primitives
  AGENTS.md       # conventions for agents & contributors
```

Shared Nx libraries under `libs/` are **not** used yet; domain code lives inside `web-app` until extracted in a follow-up task.

## Getting started

**Requirements:** Node.js 20+ (matches TanStack Router / toolchain expectations).

```sh
npm install
```

### Development server

```sh
npx nx run web-app:serve
```

Default dev URL is printed by Vite (typically `http://localhost:4200`).

### Other tasks

```sh
npx nx run web-app:build      # production build → apps/web-app/dist
npx nx run web-app:typecheck  # TypeScript project references
npx nx run web-app:lint       # ESLint

# Crypto helpers (Vitest, Node environment)
npx vitest run --config apps/web-app/vite.config.mts
```

### Environment (optional)

The template **Config** service may read `VITE_*` variables (see `apps/web-app/src/di/env`). For local cryptessage usage, defaults are enough; adjust if you extend the app with APIs.

## Security model (short)

- **Master key** — derived from passphrase + salt (salt in IndexedDB meta; not secret). **Argon2** is not implemented yet (PBKDF2 only).
- **At rest** — record payloads in IDB are AES-GCM–encrypted; passphrase never written to `localStorage`.
- **Session** — reload clears the in-memory key; user must unlock again.
- **Backup file** — encrypted blob; needs **passphrase + file** to restore on another profile/device.
- **In transit**:
  - **`openpgp`** — OpenPGP.js encrypts to the recipient public key and signs with your private key; on decrypt, cryptessage verifies signatures against the sender public key.
  - **`compact_v1`** — per-message ephemeral X25519 ECDH; the shared secret is SHA-256–expanded with a fixed domain string to derive an XSalsa20-Poly1305 key (`secretbox`). The plaintext is signed with Ed25519 and the signature is embedded in the encrypted payload, then verified on decrypt.

Implementation pointers (web app):

- `apps/web-app/src/di/messaging-crypto/messaging-crypto.provider.ts` — protocol selection + QR payload wrapping.
- `apps/web-app/src/di/openpgp-crypto/openpgp-crypto.provider.ts` — OpenPGP encrypt/sign + decrypt/verify + visit cards (`CMV2`).
- `apps/web-app/src/di/compact-crypto/compact-message.ts` and `apps/web-app/src/di/compact-crypto/visit-card.ts` — `compact_v1` packet/visit-card layout.

This is **not** a substitute for a full security audit. Threat model assumes a trusted browser runtime and no malware on the device.

## Adding contacts correctly

- Use the other person’s **full armored public key** (`-----BEGIN PGP PUBLIC KEY BLOCK-----` …) or their **QR / JSON visit card**.
- A **fingerprint** (hex id) **cannot** be used to add a contact—it only identifies a key, it does not contain key material.

Copy the full public key from **Settings** in cryptessage, or scan **Contacts → your visit card QR**.

## Contributing

Follow [apps/web-app/AGENTS.md](apps/web-app/AGENTS.md) for layering (`di` / `app` / `views`), routing, i18n, and DI module patterns.

## Nx workspace

This repo is an Nx workspace. Useful commands:

```sh
npx nx graph              # project graph
npx nx sync               # refresh TS project references
```

More: [Nx documentation](https://nx.dev).

## License

MIT (see repository root).
