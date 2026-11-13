# Run the web app in production

Build the frontend and serve `dist` with [Caddy 2](https://caddyserver.com/docs/install).
Run these commands from `web`:

```sh
pnpm install --frozen-lockfile
pnpm build
caddy run --config Caddyfile --adapter caddyfile
```

The Caddyfile defaults to plain HTTP on `:8080` with automatic HTTPS off, which
is what the container and Kubernetes use (TLS terminates at the ingress). For a
standalone host that serves HTTPS itself, set `AUTO_HTTPS=on` and `SITE_ADDRESS`
to a domain. Point DNS at the host and
allow ports 80 and 443 so Caddy can obtain and renew HTTPS certificates.
Run Caddy under your host's service manager and preserve its certificate data.

Set these environment variables in the Caddy service:

| Variable | Default | Purpose |
| --- | --- | --- |
| `SITE_ADDRESS` | `:8080` | Listen address, or a public domain when `AUTO_HTTPS=on`. |
| `AUTO_HTTPS` | `off` | Set to `on` for Caddy-managed certificates on a standalone host. |
| `API_UPSTREAM` | `127.0.0.1:3100` | API address reachable from Caddy (`api:3100` in the image). |
| `WEB_ROOT` | `dist` | Build directory. Use an absolute path when Caddy runs from another directory. |

Start the API separately using `pnpm start` from `api`, with its required
environment variables configured. Set the API's `APP_ORIGIN` to the public web
origin, such as `https://ysocial.cc`, and `NODE_ENV=production`.
Keep the API port private and reachable from Caddy.

The Caddyfile forwards `/api`, `/auth`, and their subpaths to the API without
stripping the prefix. API errors stay API responses. All other requests serve
existing files from `dist` or fall back to `index.html`, so direct visits to
`/@handle` and nested client routes work. See Caddy's
[SPA hosting pattern](https://caddyserver.com/docs/caddyfile/patterns#single-page-apps-spas).

`pnpm dev` and `pnpm preview` are for local development and build previews.

## Run with Docker

From the parent directory, build with `docker build -t ysocial-web ./web`.
The image builds the frontend and serves it with Caddy on port 8080 as a
non-root user (uid 1001). It proxies `/api` and `/auth` to `api:3100`, so
connect both containers to the same Docker network and give the API container
the name or network alias `api`. Override `API_UPSTREAM` for another address.

```sh
docker run -d --name web --network ysocial -p 3000:8080 ysocial-web
```

The image runs with a read-only root filesystem and no capabilities
(`--read-only --tmpfs /tmp --cap-drop ALL`). `GET /healthz` returns `200 ok`
without touching the API, for container and Kubernetes probes.

After deployment, check that `/@handle` returns the app HTML, a built asset
returns its file content, and `/auth/me` returns the API response. Also check
that an unknown `/api/...` path returns the API's error instead of app HTML.

Caching: `/assets/*` (hashed build output) is served `immutable` and never falls
back to `index.html`; everything else is `no-cache`.

