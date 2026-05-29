const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-environment, idempotency-key",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

function upstreamBase(): string | null {
  const url = process.env.SUPABASE_FUNCTIONS_URL?.trim();
  return url ? url.replace(/\/$/, "") : null;
}

function buildTargetUrl(pathSegments: string[] | undefined, search: string): string | null {
  const base = upstreamBase();
  if (!base) return null;
  const suffix = pathSegments?.length ? pathSegments.join("/") : "";
  const path = suffix ? `/v1/${suffix}` : "/v1";
  return `${base}${path}${search}`;
}

function forwardRequestHeaders(req: Request, anonKey: string): Headers {
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (lower === "host" || lower === "connection") return;
    headers.set(key, value);
  });
  headers.set("apikey", anonKey);
  return headers;
}

const STRIP_RESPONSE_HEADERS = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "transfer-encoding",
]);

function responseHeaders(upstream: Headers): Headers {
  const headers = new Headers();
  upstream.forEach((value, key) => {
    if (STRIP_RESPONSE_HEADERS.has(key.toLowerCase())) return;
    headers.set(key, value);
  });
  for (const [k, v] of Object.entries(CORS_HEADERS)) {
    headers.set(k, v);
  }
  return headers;
}

export function apiProxyOptions(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function proxyApiRequest(
  req: Request,
  pathSegments?: string[],
): Promise<Response> {
  const base = upstreamBase();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();
  if (!base || !anonKey) {
    return Response.json(
      {
        error: {
          code: "service_unavailable",
          message: "API proxy not configured (SUPABASE_FUNCTIONS_URL, SUPABASE_ANON_KEY)",
        },
      },
      { status: 503, headers: CORS_HEADERS },
    );
  }

  const url = new URL(req.url);
  const target = buildTargetUrl(pathSegments, url.search);
  if (!target) {
    return Response.json(
      { error: { code: "bad_request", message: "Invalid proxy target" } },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const upstream = await fetch(target, {
    method: req.method,
    headers: forwardRequestHeaders(req, anonKey),
    body: hasBody ? await req.arrayBuffer() : undefined,
  });

  const body = await upstream.arrayBuffer();

  return new Response(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders(upstream.headers),
  });
}
