const SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "connect-src 'self' https://script.google.com https://script.googleusercontent.com",
    "frame-src https://dashboardmdcgda.github.io https://docs.google.com https://sites.google.com",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "upgrade-insecure-requests"
  ].join("; "),

  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
};

const CACHE_POLICIES = {
  // Le HTML doit toujours être revalidé afin qu'une mise à jour soit visible
  // immédiatement, tout en autorisant une réponse 304 très légère.
  document: "public, max-age=0, must-revalidate",
  // Les scripts et styles restent instantanés lors des changements de page,
  // puis se mettent à jour discrètement en arrière-plan.
  code: "public, max-age=300, stale-while-revalidate=86400",
  // Les images du dépôt changent rarement. Cloudflare peut les conserver à
  // l'edge et le navigateur pendant une semaine.
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
    // Seuls GET et HEAD servent les ressources statiques. Les futures routes
    // d'API ne seront donc jamais mises en cache accidentellement.
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

    // Évite qu'un cache intermédiaire mélange des variantes compressées.
    headers.append("Vary", "Accept-Encoding");

    return new Response(asset.body, {
      status: asset.status,
      statusText: asset.statusText,
      headers
    });
  }
};
