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

  const secret = process.env.NEXTAUTH_SECRET?.trim();
  const isHttps = req.nextUrl.protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";

  let token: any = null;

  // Only attempt cryptographic JWT verification if secret is configured
  if (secret) {
    // Check with detected protocol first (supporting Cloud Run HTTPS proxy)
    token = await getToken({
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
  }

  const role = (token as any)?.role as string | undefined;

  // 1. Admin Panel Protection
  if (path.startsWith("/admin")) {
    if (!token) return NextResponse.redirect(new URL("/login", req.url));
    if (role !== "super_admin" && role !== "admin" && role !== "manager") {
      return NextResponse.redirect(new URL("/my-account", req.url));
    }
    // Defense-in-depth: coarse protection for super-admin-only routes
    if (path.startsWith("/admin/manage-admins") || path.startsWith("/admin/about")) {
      if (role !== "super_admin") {
        return NextResponse.redirect(new URL("/admin?error=unauthorized", req.url));
      }
    }
    // Defense-in-depth: coarse protection for elevated-admin-only customer & notification routes
    if (path.startsWith("/admin/customers") || path.startsWith("/admin/notifications")) {
      if (role !== "super_admin" && role !== "admin") {
        return NextResponse.redirect(new URL("/admin?error=unauthorized", req.url));
      }
    }
  }

  // 2. Rider Delivery Panel Access
  // The /delivery route hosts both the Rider Sign-In form (unauthenticated/customer)
  // and the Rider Terminal dashboard (authenticated rider).
  // All sensitive delivery actions independently enforce fail-closed authorization.
  // Customers and unauthenticated visitors are permitted to view the sign-in form.
  if (path.startsWith("/delivery")) {
    return NextResponse.next();
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