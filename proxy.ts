import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next.js 16 Proxy (formerly Middleware). Redirects the legacy manage URLs
// /<slug>/index.php?page=X[&tab=Y] to the clean /<slug>/X[/Y] routes, so old
// links and bookmarks keep working after the index.php route was removed. Other
// query params (public, token, embed, action, ...) are preserved.
export function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const match = url.pathname.match(/^\/([^/]+)\/index\.php$/);
  if (!match) return NextResponse.next();

  const slug = match[1];
  const page = url.searchParams.get("page");

  const dest = url.clone();
  // page becomes the path segment; tab/action/public/token/embed stay as query.
  dest.pathname = page ? `/${slug}/${page}` : `/${slug}/dashboard`;
  dest.searchParams.delete("page");
  return NextResponse.redirect(dest);
}

export const config = {
  matcher: "/:slug/index.php",
};
