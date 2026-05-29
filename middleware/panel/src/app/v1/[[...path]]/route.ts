import { apiProxyOptions, proxyApiRequest } from "@/lib/api-proxy";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ path?: string[] }> };

async function handle(req: Request, context: RouteContext) {
  const { path } = await context.params;
  return proxyApiRequest(req, path);
}

export async function OPTIONS() {
  return apiProxyOptions();
}

export async function GET(req: Request, context: RouteContext) {
  return handle(req, context);
}

export async function POST(req: Request, context: RouteContext) {
  return handle(req, context);
}

export async function PUT(req: Request, context: RouteContext) {
  return handle(req, context);
}

export async function PATCH(req: Request, context: RouteContext) {
  return handle(req, context);
}

export async function DELETE(req: Request, context: RouteContext) {
  return handle(req, context);
}
