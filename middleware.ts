import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Never block API routes, login route, or Next.js internal server actions
  if (
    path === "/login" ||
    path.startsWith("/login/") ||
    path.startsWith("/api") ||
    req.headers.has("next-action")
  ) {
    return NextResponse.next();
  }

  const secret = process.env.NEXTAUTH_SECRET || "ox-shoes-super-secret-key-2026";
  const isHttps = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";

  // Check with detected protocol first (supporting Cloud Run HTTPS proxy)
  let token = await getToken({
    req,
    secret,
    secureCookie: isHttps,
  });

  // If null on reverse-proxy HTTPS, fallback to checking opposite secureCookie flag
  if (!token) {
    token = await getToken({
      req,
      secret,
      secureCookie: !isHttps,
    });
  }

  // Explicit fallback checking cookie names directly
  if (!token) {
    const rawSecureCookie = req.cookies.get("__Secure-next-auth.session-token")?.value;
    if (rawSecureCookie) {
      token = await getToken({
        req,
        secret,
        cookieName: "__Secure-next-auth.session-token",
      });
    }
  }

  if (!token) {
    const rawNonSecureCookie = req.cookies.get("next-auth.session-token")?.value;
    if (rawNonSecureCookie) {
      token = await getToken({
        req,
        secret,
        cookieName: "next-auth.session-token",
      });
    }
  }

  const role = (token as any)?.role as string | undefined;

  // 1. Admin Panel Protection
  if (path.startsWith("/admin")) {
    if (!token) return NextResponse.redirect(new URL("/login", req.url));
    if (role !== "super_admin" && role !== "admin") {
      return NextResponse.redirect(new URL("/my-account", req.url));
    }
  }

  // 2. Rider Delivery Panel Protection
  if (path.startsWith("/delivery")) {
    const hasRiderCookie = Boolean(req.cookies.get("ox_rider_session")?.value);
    if (hasRiderCookie) {
      return NextResponse.next();
    }
    // Allow unauthenticated visitors to view the rider terminal login page
    if (!token) {
      return NextResponse.next();
    }
    // Block customers and managers from accessing rider terminal
    if (role !== "rider" && role !== "super_admin" && role !== "admin") {
      return NextResponse.redirect(new URL("/my-account", req.url));
    }
  }

  // 3. Customer Profile Protection
  if (path.startsWith("/my-account")) {
    if (!token) return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/delivery/:path*", "/my-account/:path*"],
};