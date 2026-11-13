# Run the web app in production

Build the frontend and serve `dist` with [Caddy 2](https://caddyserver.com/docs/install).
Run these commands from `web`:

```sh
pnpm install --frozen-lockfile
pnpm build
caddy run --config Caddyfile --adapter caddyfile
```

The default address is `https://localhost:3000`. Caddy uses a local certificate
for localhost. For public hosting, set `SITE_ADDRESS` to your domain before
starting Caddy, for example `ysocial.cc`. Point DNS at the host and
allow ports 80 and 443 so Caddy can obtain and renew HTTPS certificates.
Run Caddy under your host's service manager and preserve its certificate data.

Set these environment variables in the Caddy service:

| Variable | Default | Purpose |
| --- | --- | --- |
| `SITE_ADDRESS` | `localhost:3000` | Public domain, or `http://localhost:3000` for an HTTP smoke check. |
| `API_UPSTREAM` | `127.0.0.1:3100` | API address reachable from Caddy. |
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
The image builds the frontend and serves it with Caddy on port 80 by default.
It proxies to `api:3100`, so connect both containers to the same Docker network
and give the API container the name or network alias `api`.

```sh
docker run -d --name web --network ysocial -p 3000:80 ysocial-web
```

Override `API_UPSTREAM` if the API has a different network address. For public
HTTPS hosting, set `SITE_ADDRESS` to your domain, publish ports 80 and 443,
and mount persistent volumes at `/data` and `/config`.

After deployment, check that `/@handle` returns the app HTML, a built asset
returns its file content, and `/auth/me` returns the API response. Also check
that an unknown `/api/...` path returns the API's error instead of app HTML.
