import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const isDev = process.env.NODE_ENV === "development";
  const backend = process.env.BACKEND_URL ?? "http://localhost:8081";

  const cspDirectives = [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval'" : ""} https://fonts.googleapis.com`,
    `style-src 'self' 'unsafe-inline' 'unsafe-inline' https://fonts.googleapis.com`,
    `style-src-attr 'unsafe-inline'`,
    `font-src 'self' https://fonts.gstatic.com data:`,
    `img-src 'self' data: blob: https:`,
    `media-src 'self' data: blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `connect-src 'self' ${backend} https://fonts.googleapis.com https://fonts.gstatic.com ${isDev ? "ws: wss:" : ""}`,
    `worker-src 'self' blob:`,
    `child-src 'self' blob:`,
    `manifest-src 'self'`,
    `upgrade-insecure-requests`,
  ]
    .filter(Boolean)
    .join("; ");

  const response = NextResponse.next();

  const cspHeader =
    process.env.CSP_REPORT_ONLY === "true" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";

  response.headers.set(cspHeader, cspDirectives);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(cspHeader, cspDirectives);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
    headers: response.headers,
  });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
