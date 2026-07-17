const SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://script.google.com https://script.googleusercontent.com",
    "frame-src https://dashboardmdcgda.github.io https://docs.google.com https://sites.google.com",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "upgrade-insecure-requests"
  ].join("; "),

  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",

  "Permissions-Policy": [
    "camera=()",
    "microphone=()",
    "geolocation=()",
    "payment=()",
    "usb=()",
    "accelerometer=()",
    "gyroscope=()",
    "magnetometer=()"
  ].join(", "),

  "Strict-Transport-Security":
    "max-age=31536000; includeSubDomains; preload",

  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",

  "X-Permitted-Cross-Domain-Policies": "none"
};

export default {
  async fetch(request, env) {
    try {
      if (!env.ASSETS) {
        return new Response("Erreur : le binding ASSETS est indisponible.", {
          status: 500,
          headers: {
            "Content-Type": "text/plain; charset=UTF-8"
          }
        });
      }

      const asset = await env.ASSETS.fetch(request);
      const headers = new Headers(asset.headers);

      for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
        headers.set(name, value);
      }

      return new Response(asset.body, {
        status: asset.status,
        statusText: asset.statusText,
        headers
      });
    } catch (error) {
      console.error("Erreur du Worker :", error);

      return new Response("Une erreur interne est survenue.", {
        status: 500,
        headers: {
          "Content-Type": "text/plain; charset=UTF-8",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY"
        }
      });
    }
  }
};
