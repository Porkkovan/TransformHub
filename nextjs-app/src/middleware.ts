import { NextRequest, NextResponse } from "next/server";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 100;

// In-memory rate limiter. In production, replace with Redis-based rate limiting
// (e.g. using @upstash/ratelimit) for consistent limits across serverless instances.
const requestCounts = new Map<string, { count: number; resetAt: number }>();

// Periodic cleanup to prevent memory leaks from stale entries
const CLEANUP_INTERVAL_MS = 5 * 60_000; // 5 minutes
let lastCleanup = Date.now();

function cleanupStaleEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of requestCounts) {
    if (now > entry.resetAt) {
      requestCounts.delete(key);
    }
  }
}

const PUBLIC_PATHS = ["/login", "/signup", "/api/auth", "/api/health"];

/**
 * Extract client IP from the request, checking standard proxy headers.
 * Uses x-forwarded-for (first entry), x-real-ip, or falls back to "unknown".
 */
function getClientIp(request: NextRequest): string {
  // x-forwarded-for can be spoofed, but the first entry from a trusted proxy
  // is typically the real client IP. In production, configure your proxy/CDN
  // to set a trusted header.
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0]?.trim();
    if (firstIp && firstIp !== "unknown") return firstIp;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  // Edge runtime doesn't expose socket info; fall back to "unknown"
  return "unknown";
}

function checkRateLimit(key: string): { allowed: boolean; remaining: number } {
  cleanupStaleEntries();

  const now = Date.now();
  const entry = requestCounts.get(key);

  if (!entry || now > entry.resetAt) {
    requestCounts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for NextAuth session cookie for page routes
  const isPageRoute = !pathname.startsWith("/api/");
  if (isPageRoute) {
    const sessionToken =
      request.cookies.get("__Secure-authjs.session-token")?.value ||
      request.cookies.get("authjs.session-token")?.value ||
      request.cookies.get("__Secure-next-auth.session-token")?.value ||
      request.cookies.get("next-auth.session-token")?.value;

    if (!sessionToken) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // API route handling - skip non-API and health
  if (!pathname.startsWith("/api/") || pathname === "/api/health") {
    return NextResponse.next();
  }

  // Rate limiting by client IP
  const clientIp = getClientIp(request);
  const rateLimitKey = `api:${clientIp}`;
  const { allowed, remaining } = checkRateLimit(rateLimitKey);

  if (!allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": "60",
          "X-RateLimit-Limit": String(RATE_LIMIT_MAX),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  // Note: API key authentication for external/programmatic access is still supported.
  // Session-based auth is enforced in each API route handler via requireAuth().
  // The API key check here is an additional layer for non-browser clients.
  const apiKey = process.env.API_KEY;
  if (apiKey) {
    const authHeader = request.headers.get("authorization");
    const providedKey = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : request.headers.get("x-api-key");

    // Only enforce API key for requests without a session cookie
    const hasSessionCookie =
      request.cookies.get("__Secure-authjs.session-token")?.value ||
      request.cookies.get("authjs.session-token")?.value ||
      request.cookies.get("__Secure-next-auth.session-token")?.value ||
      request.cookies.get("next-auth.session-token")?.value;

    if (!hasSessionCookie && providedKey !== apiKey) {
      return NextResponse.json(
        { error: "Unauthorized. Provide a valid API key or session." },
        { status: 401 }
      );
    }
  }

  const response = NextResponse.next();
  response.headers.set("X-RateLimit-Limit", String(RATE_LIMIT_MAX));
  response.headers.set("X-RateLimit-Remaining", String(remaining));
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
