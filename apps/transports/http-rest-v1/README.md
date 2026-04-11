# Reference server: `http_rest_v1`

Minimal **Fastify** app using **Inversify** and [`@inversifyjs/http-fastify`](https://inversify.io/framework/docs/introduction/getting-started/) implementing the contract in [`docs/transports/http-rest-v1.md`](../../../docs/transports/http-rest-v1.md) (challenge + inbox POST, PoW per [`docs/transports/security.md`](../../../docs/transports/security.md)).

**Layout** (same pattern as [`apps/web-app/src/di/conversation`](../../web-app/src/di/conversation)): each feature lives under `src/di/<name>/` with **`types.ts`** (service `Symbol` + `I…` interface), **`<name>.provider.ts`** (`*Provider` class), and **`module.ts`** (`ContainerModule`). Root [`container.ts`](src/di/container.ts) loads [`server-config`](src/di/server-config) (env constant) plus feature modules; HTTP routes are in [`inbox/inbox.provider.ts`](src/di/inbox/inbox.provider.ts) (`InboxController`).

## Prerequisites

- Node.js compatible with the monorepo
- `DEPLOYMENT_SECRET` set (must match the **path segment** before `/v1` in client `baseUrl`)

The server registers **`@fastify/cors`** so browser clients (e.g. web-app on another origin/port) get `Access-Control-Allow-*` on preflight and responses; allowed headers include `Authorization`, `Content-Type`, `X-Cryptessage-Pow`, and `Idempotency-Key`. **`CORS_ORIGIN`** (optional) restricts allowed origins; if unset, empty, or `*`, any origin is allowed (same as `origin: true`).

## Configure

| Variable | Required | Description |
| --- | --- | --- |
| `DEPLOYMENT_SECRET` | yes | Same string embedded in public URL: `https://host/<this>/v1` |
| `PORT` | no | Listen port (default `3333`) |
| `CHALLENGE_DIFFICULTY_BITS` | no | PoW difficulty (default `18`) |
| `INBOX_BEARER_TOKEN` | no | If set, require `Authorization: Bearer …` on all routes |
| `SKIP_POW` | no | If `true`, skip PoW **only** for localhost requests (see security doc; **never** in production) |
| `OUTBOX_PAGE_SIZE` | no | Max messages per `GET …/outbox/…` page (default `50`, max `200`) |
| `CORS_ORIGIN` | no | Browser CORS allowlist: unset / empty / `*` = **any** origin; one URL = single origin; comma-separated = multiple (e.g. `https://a.com,https://b.com`) |

## Run (Nx)

From the monorepo root:

```bash
npx nx run http-rest-v1:build
set DEPLOYMENT_SECRET=devsecret
set PORT=3333
npx nx run http-rest-v1:serve
```

(PowerShell: `$env:DEPLOYMENT_SECRET="devsecret"` then `npx nx run http-rest-v1:serve`.)

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

**Required:** `DEPLOYMENT_SECRET` — the same secret as in the client URL: `https://your-host/<DEPLOYMENT_SECRET>/v1`.

```bash
docker run -d --name http-rest-v1 \
  --restart unless-stopped \
  -p 3333:3333 \
  -e DEPLOYMENT_SECRET='use-a-long-random-secret' \
  -e PORT=3333 \
  cryptessage-http-rest-v1:latest
```

Replace `use-a-long-random-secret` and the host port (`3333:3333`) with your own values. Environment variables are set **only inside the container** via `-e`; nothing is written to your shell.

For a shared bearer token, add `-e INBOX_BEARER_TOKEN='…'` and set the same value as `bearerToken` on the client profile.

Smoke check (must match the `-e` values above):

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
| [`package.runtime.json`](package.runtime.json) | Runtime dependencies (Fastify, Inversify, …). If new `node_modules` imports appear after code changes, align versions with the repo root `package.json` |

## Client profile (`http_rest_v1`)

Use a `baseUrl` that ends with your deployment segment and `/v1`, for example:

```json
{
  "baseUrl": "http://127.0.0.1:3333/devsecret/v1",
  "skipPow": true
}
```

Set `skipPow: true` only for **localhost** hosts when this server runs with `SKIP_POW=true`. Otherwise omit it and send PoW as in the spec.

Optional shared token:

```json
{
  "baseUrl": "http://127.0.0.1:3333/devsecret/v1",
  "bearerToken": "<same as INBOX_BEARER_TOKEN>"
}
```

## Routes

- `GET /:deploymentSecret/v1/challenge` — JSON challenge; stores nonce server-side until expiry or successful use on another endpoint.
- `POST /:deploymentSecret/v1/inbox/:recipientKeyId` — raw body `application/octet-stream`, `202` on success; verifies `X-Cryptessage-Pow` unless local `SKIP_POW` mode applies. Optional `Idempotency-Key` (≤256 chars): duplicate key within **24h** returns `202` with `deduplicated: true` without storing the body again.
- `GET /:deploymentSecret/v1/outbox/:selfKeyId?since=<cursor>` — JSON `{ "nextCursor": string | null, "messages": [ "<base64>" ] }` (RFC 4648 base64); PoW + bearer same as inbox. Cursor is opaque (reference format: base64url of `{"v":1,"ls":<lastSeq>}`); omit `since` to read from the start. Pagination size: `OUTBOX_PAGE_SIZE`.

Stack notes: [Inversify HTTP getting started](https://inversify.io/framework/docs/introduction/getting-started/) and [`@inversifyjs/http-fastify`](https://www.npmjs.com/package/@inversifyjs/http-fastify).

## curl smoke test

```bash
export SECRET=devsecret
export BASE="http://127.0.0.1:3333/$SECRET/v1"

curl -sS "$BASE/challenge"
# solve PoW offline or use SKIP_POW on both sides for localhost

curl -sS -X POST \
  -H "Content-Type: application/octet-stream" \
  -H "X-Cryptessage-Pow: <base64url-of-proof-json>" \
  --data-binary @message.bin \
  "$BASE/inbox/recipientKeyIdHex"

# Outbox (same PoW/bearer rules; example uses SKIP_POW on localhost only)
curl -sS "$BASE/outbox/recipientKeyIdHex"
```
