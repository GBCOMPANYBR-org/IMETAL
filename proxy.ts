import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];
// The QR-code page/download route for Anexos — deliberately public, no login, gated only by
// the opaque per-Pedido token and each file's enabledForQr flag (see lib/attachment-group.ts).
const PUBLIC_PREFIXES = ["/public/anexos/", "/api/public/anexos/"];

async function hasValidSession(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const authenticated = await hasValidSession(req);

  if (!authenticated) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match everything except:
     * - _next/static, _next/image (build assets)
     * - favicon.ico, icon.png, apple-icon.png, logo.png and other public files
     * - robots.txt (precisa ficar público mesmo sem login, senão o Google não
     *   consegue ler o "Disallow: /" e não bloqueia a indexação como deveria)
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|logo.png|robots.txt).*)",
  ],
};
