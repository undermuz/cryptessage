# Reference server: `http_rest_v1`

Minimal **Fastify** app using **Inversify** and [`@inversifyjs/http-fastify`](https://inversify.io/framework/docs/introduction/getting-started/) implementing the contract in [`docs/transports/http-rest-v1.md`](../../../docs/transports/http-rest-v1.md) (challenge + inbox POST + outbox GET, PoW per [`docs/transports/security.md`](../../../docs/transports/security.md)).

**Adaptive PoW (default):** after a successful `X-Cryptessage-Pow` verification, the server returns **`X-Cryptessage-Session`**; follow-up requests may send that header instead of a new proof until idle or rate limits kick in. **`POW_MODE=always`** disables sessions (every request needs a fresh PoW). Details and JSON **`clientHints`** on `GET /challenge` are in the docs above.

**Layout** (same pattern as [`apps/web-app/src/di/conversation`](../../web-app/src/di/conversation)): each feature lives under `src/di/<name>/` with **`types.ts`** (service `Symbol` + `I…` interface), **`<name>.provider.ts`** (`*Provider` class), and **`module.ts`** (`ContainerModule`). Root [`container.ts`](src/di/container.ts) loads [`server-config`](src/di/server-config) (env constant) plus feature modules; HTTP routes are in [`inbox/inbox.provider.ts`](src/di/inbox/inbox.provider.ts) (`InboxController`).

## Prerequisites

- Node.js compatible with the monorepo
- `DEPLOYMENT_SECRET` set (must match the **path segment** before `/v1` in client `baseUrl`)
- `SESSION_HMAC_SECRET` set for default **adaptive** PoW (server-only; **not** the deployment path secret — see table below)

The server registers **`@fastify/cors`** so browser clients (e.g. web-app on another origin/port) get `Access-Control-Allow-*` on preflight and responses. Allowed request headers include `Authorization`, `Content-Type`, `X-Cryptessage-Pow`, **`X-Cryptessage-Session`**, and `Idempotency-Key`. **`X-Cryptessage-Session`** is also listed in **`Access-Control-Expose-Headers`** so `fetch` can read rotated session tokens from responses. **`CORS_ORIGIN`** (optional) restricts allowed origins; if unset, empty, or `*`, any origin is allowed (same as `origin: true`).

## Configure

**Recommended:** keep values in an env file. Copy [`env.example`](env.example) to **`apps/transports/http-rest-v1/.env`** (gitignored), edit secrets, then:

- **Docker:** `docker run … --env-file apps/transports/http-rest-v1/.env` (path relative to monorepo root).
- **Local shell:** load the file before `nx serve` (see [Run (Nx)](#run-nx)).

| Variable | Required | Description |
| --- | --- | --- |
| `DEPLOYMENT_SECRET` | yes | Same string embedded in public URL: `https://host/<this>/v1` |
| `PORT` | no | Listen port (default `3333`) |
| `CHALLENGE_DIFFICULTY_BITS` | no | PoW difficulty (default `18`) |
| `INBOX_BEARER_TOKEN` | no | If set, require `Authorization: Bearer …` on all routes |
| `SKIP_POW` | no | If `true`, skip PoW **only** for localhost requests (see security doc; **never** in production) |
| `POW_MODE` | no | `adaptive` (default) or `always`; `always` = no session headers, PoW on every protected request |
| `POW_IDLE_MS_BEFORE_POW` | no | Sliding idle (ms) before the next request must use PoW again (default `1800000` = 30 min) |
| `POW_MAX_RPS` | no | Max requests per rolling 1s window **per session** on the server (default `5`) |
| `POW_MAX_RPM` | no | Max requests per rolling 60s window **per session** on the server (default `350`) |
| `SESSION_HMAC_SECRET` | **yes** (adaptive) | HMAC key for `X-Cryptessage-Session`; must be **server-only** and **not** the same as `DEPLOYMENT_SECRET` (clients already have the latter in `baseUrl` and could forge sessions). Optional when `POW_MODE=always` (sessions unused) |
| `SESSION_MAX_TTL_MS` | no | Hard max session age from first issue (default `86400000` = 24h) |
| `OUTBOX_PAGE_SIZE` | no | Max messages per `GET …/outbox/…` page (default `50`, max `200`) |
| `CORS_ORIGIN` | no | Browser CORS allowlist: unset / empty / `*` = **any** origin; one URL = single origin; comma-separated = multiple (e.g. `https://a.com,https://b.com`) |

## Run (Nx)

From the monorepo root, after copying [`env.example`](env.example) → `apps/transports/http-rest-v1/.env` and editing it:

```bash
npx nx run http-rest-v1:build
set -a && . apps/transports/http-rest-v1/.env && set +a
npx nx run http-rest-v1:serve
```

(`set -a` / `set +a` — export all variables assigned while sourcing the file; use a POSIX shell. Adaptive mode **requires** `SESSION_HMAC_SECRET` distinct from `DEPLOYMENT_SECRET`.)

**PowerShell:** Docker with `--env-file` is the least awkward; for local Nx, set ` $env:DEPLOYMENT_SECRET`, `$env:SESSION_HMAC_SECRET`, etc. manually, or use a small script that parses `.env`.

## Docker (Linux server)

Build the image from the **monorepo root** (next to `package.json` and `apps/`): the `Dockerfile` copies the lockfile and runs `tsc` against that layout.

### 1. Install Docker

Debian/Ubuntu example:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${VERSION_CODENAME:-jammy}") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker "$USER"
# log out and back in so the docker group applies
```

On other distros, see the official [Docker Engine install](https://docs.docker.com/engine/install/) docs.

### 2. Clone the repo and build the image

```bash
git clone <your-fork-or-upstream-url> cryptessage
cd cryptessage

docker build -f apps/transports/http-rest-v1/Dockerfile -t cryptessage-http-rest-v1:latest .
```

The build runs `npm ci --legacy-peer-deps` to tolerate peer-dependency conflicts in the monorepo.

### 3. Run the container

1. From the monorepo root, copy [`env.example`](env.example) to `apps/transports/http-rest-v1/.env` and set at least **`DEPLOYMENT_SECRET`** and **`SESSION_HMAC_SECRET`** (for adaptive mode; see **Configure**). **`SESSION_HMAC_SECRET` must differ from `DEPLOYMENT_SECRET`** — the deployment segment is in every client `baseUrl`; reusing it for session HMAC would let clients forge `X-Cryptessage-Session**.
2. Run (paths relative to monorepo root, e.g. `cryptessage/`):

```bash
docker run -d --name http-rest-v1 \
  --restart unless-stopped \
  -p 3333:3333 \
  --env-file apps/transports/http-rest-v1/.env \
  cryptessage-http-rest-v1:latest
```

Adjust host port mapping if `PORT` in the file is not `3333` (use `-p "${PORT}:${PORT}"` or map accordingly).

Add optional variables to the **same** file (`INBOX_BEARER_TOKEN`, `POW_MODE=always`, `POW_IDLE_MS_BEFORE_POW`, …) instead of repeating `-e` flags. For a one-off smoke test you can still pass `-e KEY=value`, but **env-file is the recommended format** for real deployments.

Smoke check (replace `use-a-long-random-secret` with your `DEPLOYMENT_SECRET`):

```bash
curl -sS "http://127.0.0.1:3333/use-a-long-random-secret/v1/challenge"
```

### 4. Production: TLS and port 443

The container serves plain HTTP (default port **3333**). On a public host, put a **reverse proxy** (Caddy, nginx, Traefik) with TLS in front and proxy to `127.0.0.1:3333`. Prefer exposing only 443 (and 80 for ACME) in the firewall; do not publish the app port directly:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### Image files

| File | Role |
| --- | --- |
| [`Dockerfile`](Dockerfile) | Multi-stage build: `tsc` in builder; runtime image has only `dist/` and minimal dependencies |
| [`env.example`](env.example) | Template for **`--env-file`** / local `.env` (copy to `.env`, do not commit) |
| [`package.runtime.json`](package.runtime.json) | Runtime dependencies (Fastify, Inversify, …). If new `node_modules` imports appear after code changes, align versions with the repo root `package.json` |

## Client profile (`http_rest_v1`)

Use a `baseUrl` that ends with your deployment segment and `/v1`, for example:

```json
{
  "baseUrl": "http://127.0.0.1:3333/devsecret/v1",
  "skipPow": true
}
```

Set `skipPow: true` only for **localhost** hosts when this server runs with `SKIP_POW=true`. Otherwise the web-app uses **adaptive** PoW by default: solve a challenge when needed, then reuse **`X-Cryptessage-Session`** until idle or rate limits (see transport docs).

Optional overrides (only if you need to hard-code policy on the client; usually omit and follow `clientHints` from `GET /challenge`):

```json
{
  "baseUrl": "https://example.com/your-secret/v1",
  "powMode": "adaptive",
  "powIdleMsBeforePow": 1800000,
  "powMaxRps": 5,
  "powMaxRpm": 350
}
```

Use `"powMode": "always"` on the client to force a new PoW every request even against an adaptive server.

Optional shared token:

```json
{
  "baseUrl": "http://127.0.0.1:3333/devsecret/v1",
  "bearerToken": "<same as INBOX_BEARER_TOKEN>"
}
```

## Routes

- `GET /:deploymentSecret/v1/challenge` — JSON challenge plus optional **`clientHints`** (`powMode`, `idleMsBeforePow`, `maxRps`, `maxRpm`); stores nonce server-side until expiry or successful use on a protected endpoint.
- `POST /:deploymentSecret/v1/inbox/:recipientKeyId` — raw body `application/octet-stream`, `202` on success. Verifies **`X-Cryptessage-Pow`** or, in **`POW_MODE=adaptive`**, a valid **`X-Cryptessage-Session`**, unless local `SKIP_POW` applies. On success in adaptive mode, response may include **`X-Cryptessage-Session`** (omitted when `POW_MODE=always`). Optional `Idempotency-Key` (≤256 chars): duplicate key within **24h** returns `202` with `deduplicated: true` without storing the body again (no new session header on that shortcut).
- `GET /:deploymentSecret/v1/outbox/:selfKeyId?since=<cursor>` — JSON `{ "nextCursor": string | null, "messages": [ "<base64>" ] }` (RFC 4648 base64); same PoW/session + bearer rules as inbox. Cursor is opaque (reference format: base64url of `{"v":1,"ls":<lastSeq>}`); omit `since` to read from the start. Pagination size: `OUTBOX_PAGE_SIZE`.

Stack notes: [Inversify HTTP getting started](https://inversify.io/framework/docs/introduction/getting-started/) and [`@inversifyjs/http-fastify`](https://www.npmjs.com/package/@inversifyjs/http-fastify).

## curl smoke test

```bash
export SECRET=devsecret
export BASE="http://127.0.0.1:3333/$SECRET/v1"

curl -sS "$BASE/challenge"
# solve PoW offline or use SKIP_POW on both sides for localhost
# adaptive mode: read X-Cryptessage-Session from -D headers and pass it on the next request

curl -sS -X POST \
  -H "Content-Type: application/octet-stream" \
  -H "X-Cryptessage-Pow: <base64url-of-proof-json>" \
  --data-binary @message.bin \
  "$BASE/inbox/recipientKeyIdHex"

# Outbox (same PoW / session / bearer rules; example uses SKIP_POW on localhost only)
curl -sS "$BASE/outbox/recipientKeyIdHex"
```
