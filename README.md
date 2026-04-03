# cryptessage

Browser-based, **offline-first** messaging for hostile networks: you exchange **OpenPGP public keys in person** (QR or paste), then move **encrypted payloads** over any channel (messengers, email, even another phone’s camera via QR).

There are **no central servers** and **no cloud account**. A **passphrase** derives a master key (**PBKDF2**); **contacts, messages, and private keys** are stored in **IndexedDB** encrypted with **AES-GCM**. The passphrase is **never** persisted—only kept in memory for the session.

> **v0.1** ships as a normal **SPA** (Vite). Installable **PWA** (service worker, manifest) is planned as a separate iteration.

## Features

- **Unlock / create vault / restore backup** — one JSON backup file, encrypted with the same KDF + AES-GCM as the database (salt embedded in the file header).
- **OpenPGP** — ECC keys (OpenPGP.js), encrypt+sign to a contact, decrypt+verify inbound armored messages.
- **QR** — visit cards (JSON payload) and encrypted message blobs (length-limited; very long text may not fit a single QR).
- **TanStack Router** — typed routes with an auth guard: locked session redirects to `/unlock`.
- **InversifyJS** — crypto, storage, identity, backup, and conversation services are wired through DI (see `apps/web-app/src/di`).

## Stack

| Area        | Technology                                      |
| ----------- | ----------------------------------------------- |
| Monorepo    | Nx                                              |
| App         | React 19, Vite 8, TypeScript                    |
| UI          | Tailwind CSS 4, shadcn-style primitives (Base UI) |
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
