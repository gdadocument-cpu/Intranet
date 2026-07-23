const SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self' https://script.google.com https://script.googleusercontent.com https://opensheet.elk.sh",
    "frame-src 'self' https://dashboardmdcgda.github.io https://docs.google.com https://sites.google.com",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests"
  ].join("; "),

  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
};

const CACHE_POLICIES = {
  document: "public, max-age=0, must-revalidate",
  code: "public, max-age=300, stale-while-revalidate=86400",
  image: "public, max-age=604800, stale-while-revalidate=2592000",
  font: "public, max-age=2592000, stale-while-revalidate=2592000",
  other: "public, max-age=3600, stale-while-revalidate=86400"
};

function cachePolicyFor(pathname, contentType) {
  const path = pathname.toLowerCase();
  const type = String(contentType || "").toLowerCase();

  if (path.endsWith(".html") || type.includes("text/html")) {
    return CACHE_POLICIES.document;
  }
  if (/\.(?:js|mjs|css)$/.test(path) ||
      type.includes("javascript") || type.includes("text/css")) {
    return CACHE_POLICIES.code;
  }
  if (/\.(?:png|jpe?g|gif|webp|avif|svg|ico)$/.test(path) ||
      type.startsWith("image/")) {
    return CACHE_POLICIES.image;
  }
  if (/\.(?:woff2?|ttf|otf)$/.test(path) || type.startsWith("font/")) {
    return CACHE_POLICIES.font;
  }
  return CACHE_POLICIES.other;
}

export default {
  async fetch(request, env) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Méthode non autorisée", {
        status: 405,
        headers: { Allow: "GET, HEAD", ...SECURITY_HEADERS }
      });
    }

    const asset = await env.ASSETS.fetch(request);
    const headers = new Headers(asset.headers);
    const url = new URL(request.url);

    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      headers.set(name, value);
    }

    headers.set(
      "Cache-Control",
      cachePolicyFor(url.pathname, headers.get("Content-Type"))
    );
    headers.append("Vary", "Accept-Encoding");

    return new Response(asset.body, {
      status: asset.status,
      statusText: asset.statusText,
      headers
    });
  }
};
