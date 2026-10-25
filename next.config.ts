import type { NextConfig } from "next";

const useMockBackend = process.env.FILE_BACKEND?.trim().toLowerCase() === "mock";
const isDev = process.env.NODE_ENV !== "production";

// `VERCEL_ENV` is "production" | "preview" | "development" on Vercel and unset
// elsewhere. Preview deployments embed the Vercel toolbar (feedback/comments),
// which loads scripts, frames, fonts and a websocket from vercel.live and
// would otherwise be blocked by the policy below.
const isVercelPreview = process.env.VERCEL_ENV === "preview";

/**
 * Content Security Policy.
 *
 * GitCloak keeps repository passwords and decrypted text in browser memory, so
 * the main job of the policy is to stop injected script from running or from
 * sending data anywhere: no third-party scripts, and `connect-src` limited to
 * same-origin. `'unsafe-inline'` is required for Next.js' inline bootstrap
 * scripts and for styles injected by Radix/Tailwind; moving to per-request
 * nonces would be the next hardening step.
 */
function contentSecurityPolicy(): string {
  const vercelLive = isVercelPreview
    ? {
        script: ["https://vercel.live"],
        connect: ["https://vercel.live", "https://*.pusher.com", "wss://*.pusher.com"],
        frame: ["https://vercel.live"],
        img: ["https://vercel.live", "https://vercel.com", "https://sockjs-us3.pusher.com"],
        font: ["https://vercel.live", "https://assets.vercel.com"],
        style: ["https://vercel.live"],
      }
    : { script: [], connect: [], frame: [], img: [], font: [], style: [] };

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      // React's dev tooling and hot reload need eval; never in production.
      ...(isDev ? ["'unsafe-eval'"] : []),
      ...vercelLive.script,
    ],
    "style-src": ["'self'", "'unsafe-inline'", ...vercelLive.style],
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      "https://avatars.githubusercontent.com",
      ...vercelLive.img,
    ],
    "font-src": ["'self'", "data:", ...vercelLive.font],
    "connect-src": ["'self'", ...vercelLive.connect],
    "frame-src": vercelLive.frame.length ? vercelLive.frame : ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    // Sign-in posts to our own route, which redirects to github.com; browsers
    // apply form-action to that redirect too.
    "form-action": ["'self'", "https://github.com"],
    "frame-ancestors": ["'none'"],
  };

  const policy = Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");

  return isDev ? policy : `${policy}; upgrade-insecure-requests`;
}

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  // Vercel serves everything over HTTPS; HSTS only means something there.
  ...(isDev
    ? []
    : [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
      ]),
];

const nextConfig: NextConfig = {
  // Allows end-to-end tests to run a second dev server with an isolated build
  // directory so it does not clash with a locally running `next dev`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Do not advertise the framework in a response header.
  poweredByHeader: false,
  // Expose the backend selection to client components so they can behave
  // sensibly when running against the mock backend (no real OAuth).
  env: {
    NEXT_PUBLIC_MOCK_BACKEND: useMockBackend ? "1" : "0",
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Responses carry per-user repository data; keep them out of shared caches.
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },
};

export default nextConfig;
