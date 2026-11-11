import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // The admin dashboard is not localized. Signed-out visitors are sent to the
  // login page early; the session itself is verified on the server for every
  // admin page and action (see src/lib/auth.ts).
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    const isLogin = pathname === "/admin/login";
    if (!isLogin && !request.cookies.has("ob_admin")) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    const response = NextResponse.next();
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }

  // Payment links (/give/250) forward to Ye-Buna: see src/app/give.
  if (pathname === "/give" || pathname.startsWith("/give/")) return NextResponse.next();

  return intl(request);
}

export const config = {
  // Match all pathnames except for:
  // - /api routes
  // - /_next and /_vercel internals
  // - any path containing a dot (static files: /img, /css, /icon, /vendor, etc.)
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
