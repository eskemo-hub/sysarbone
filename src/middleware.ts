import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Basic Security Headers
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-XSS-Protection", "1; mode=block");

  // API Key Check for /api/external routes
  if (request.nextUrl.pathname.startsWith("/api/external")) {
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing API key" },
        { status: 401 }
      );
    }
    // Note: We don't validate the key against DB here to avoid Edge/Prisma issues.
    // Validation happens in the route handler or a specialized non-edge middleware.
  }

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
