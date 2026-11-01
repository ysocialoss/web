import type { APIEvent } from "@solidjs/start/server";
export async function forward({ request }: APIEvent) {
  const url = new URL(request.url);
  try {
    let body: string | undefined;
    if (["POST", "PATCH"].includes(request.method) && request.body) {
      // Enforce the API's limit before buffering an untrusted request.
      const reader = request.body.getReader();
      const decoder = new TextDecoder();
      let size = 0;
      body = "";
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > 16 * 1024) {
            await reader.cancel();
            return Response.json(
              { error: "Request body is too large" },
              { status: 413, headers: { "Cache-Control": "no-store" } },
            );
          }
          body += decoder.decode(chunk.value, { stream: true });
        }
        body += decoder.decode();
      } finally {
        reader.releaseLock();
      }
    }
    const response = await fetch(
      new URL(
        url.pathname + url.search,
        process.env.API_URL || "http://127.0.0.1:3100",
      ),
      {
        method: request.method,
        headers: {
          "Content-Type": "application/json",
          cookie: request.headers.get("cookie") || "",
          origin: request.headers.get("origin") || "",
        },
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(25000),
      },
    );
    const headers = new Headers({
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    });
    for (const name of ["content-type", "location"]) {
      const value = response.headers.get(name);
      if (value) headers.set(name, value);
    }
    for (const value of response.headers.getSetCookie())
      headers.append("Set-Cookie", value);
    return new Response(response.body, { status: response.status, headers });
  } catch {
    return Response.json(
      { error: "backend_unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
