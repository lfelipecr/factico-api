import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") ?? "";

  if (pathname.startsWith("/v1")) {
    return NextResponse.next();
  }

  if (host.startsWith("apife.") && pathname === "/") {
    return NextResponse.json({
      service: "Factico API",
      documentation: "https://lfelipecr.github.io/factico-api/api/",
    });
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
