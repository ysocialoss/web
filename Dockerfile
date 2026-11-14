# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:24-bookworm-slim
ARG CADDY_IMAGE=caddy:2.10-alpine
ARG ALPINE_IMAGE=alpine:3.22

FROM ${NODE_IMAGE} AS build
WORKDIR /app
RUN npm install --global pnpm@12.16.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# nly the caddy binary is taken from the upstream image. It ships with the
# file capability cap_net_bind_service, which COPY --from preserves and which
# makes exec fail under `capabilities: drop: [ALL]`. a plain cp does not carry
# it over, and the app listens on 8080, which needs no capability
FROM ${CADDY_IMAGE} AS caddy

FROM ${ALPINE_IMAGE} AS runtime
ARG VERSION=dev
ARG REVISION=unknown
LABEL org.opencontainers.image.title="ysocial-web" \
      org.opencontainers.image.source="https://github.com/ysocialoss/web" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${REVISION}"

RUN addgroup -g 1001 -S web && adduser -S -u 1001 -G web web
RUN --mount=from=caddy,source=/usr/bin/caddy,target=/tmp/caddy cp /tmp/caddy /usr/bin/caddy
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build --chown=web:web /app/dist /srv

# hi apfeltashh, i just know youll never read this, since you dont ACTUALLY review any code lol (or atleast i thnk so)
# plain HTTP behind the ingress, which terminates TLS. caddy needs a writable
# home for its state; /tmp is an emptyDir when the root filesystem is read-only
ENV SITE_ADDRESS=:8080 \
    API_UPSTREAM=api:3100 \
    WEB_ROOT=/srv \
    AUTO_HTTPS=off \
    XDG_DATA_HOME=/tmp/caddy-data \
    XDG_CONFIG_HOME=/tmp/caddy-config

USER 1001:1001
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
