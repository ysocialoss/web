import type { APIEvent } from "@solidjs/start/server";
import { forward } from "~/lib/api-proxy";
function auth(event: APIEvent) {
  if (
    ![
      "/auth/login",
      "/auth/callback",
      "/auth/me",
      "/auth/profile",
      "/auth/logout",
    ].includes(new URL(event.request.url).pathname)
  ) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return forward(event);
}
export const GET = auth;
export const POST = auth;
