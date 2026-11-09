# ysocial web

The React frontend connects to the Express API in `../api`. It supports public feeds, CNS sign-in, onboarding, posting, replies, likes, reposts, edits, deletion, and public profiles.

## Run locally

Start PostgreSQL and configure the API using [the API setup guide](../api/README.md). Then run these commands in separate terminals:

```sh
cd api
pnpm dev
```

```sh
cd web
pnpm install
pnpm dev
```

Open `http://localhost:3000`. Vite forwards `/api` and `/auth` to port 3100. Set `API_URL` in the Vite environment to use another backend. The API's `APP_ORIGIN` must match the browser origin.

## Check changes

```sh
pnpm build
pnpm lint
```

See the [API reference](../api/docs/README.md) for every route and the [web integration reference](../api/docs/web-integration.md) for frontend paths and deployment requirements.
