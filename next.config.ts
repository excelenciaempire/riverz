import type { NextConfig } from "next";

/**
 * Security headers applied to every response.
 *
 * CSP is intentionally pragmatic — Clerk and Stripe both inject inline scripts
 * and connect to their own domains. We allow them explicitly. If you tighten
 * this further (e.g. drop 'unsafe-eval'), test the dashboard end-to-end first
 * because Next.js dev tooling can break.
 */
const buildCsp = (frameAncestors: string) =>
  [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://*.clerk.com https://clerk.riverzai.com https://js.stripe.com https://challenges.cloudflare.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    // Meta serves ad creatives + thumbnails from *.fbcdn.net, scontent.*.fbcdn.net,
    // video.*.fbcdn.net and *.cdninstagram.com. They also occasionally hand out
    // graph.facebook.com URLs for processed assets. Whitelist all four so the
    // Meta Ads viewer can render Facebook-hosted images and play Facebook-hosted
    // video sources directly.
    // kie.ai serves the actual rendered files from *.aiquickdraw.com (their CDN)
    // not from kie.ai itself. We mirror the result into Supabase Storage on
    // success, but the fallback path in saveResult keeps the kie URL — so
    // aiquickdraw needs to be allowed too, otherwise the browser blocks the
    // image even though we already paid for it.
    "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://*.kie.ai https://*.aiquickdraw.com https://*.googleusercontent.com https://*.cloudfront.net https://*.amazonaws.com https://*.elevenlabs.io https://riverzai.com https://cdn.riverzai.com https://placehold.co https://img.clerk.com https://*.clerk.com https://*.clerk.accounts.dev https://*.fbcdn.net https://*.cdninstagram.com https://graph.facebook.com",
    "media-src 'self' blob: https://*.supabase.co https://*.supabase.in https://*.kie.ai https://*.aiquickdraw.com https://*.cloudfront.net https://*.amazonaws.com https://*.fbcdn.net https://*.cdninstagram.com",
    // connect-src governs fetch() / XHR / WebSocket. The Descargar button
    // calls fetch() against Meta's CDN to bundle the asset into a Blob, so
    // *.fbcdn.net + *.cdninstagram.com need to be here too — img-src/media-src
    // alone don't cover programmatic fetches.
    "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://clerk.riverzai.com https://api.stripe.com https://*.supabase.co https://*.supabase.in wss://*.supabase.co https://api.kie.ai https://api.elevenlabs.io https://api.openai.com https://graph.facebook.com https://*.fbcdn.net https://*.cdninstagram.com",
    // www.facebook.com is allowed so the Meta Ads viewer can fall back to
    // Facebook's official preview iframe when /{video_id}?fields=source
    // returns null. The iframe loads from facebook.com/ads/api/preview_iframe.php
    // and is signed with the user's own access token.
    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com https://www.facebook.com",
    "worker-src 'self' blob:",
    `frame-ancestors ${frameAncestors}`,
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join('; ');

const BASE_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const SECURITY_HEADERS = [
  ...BASE_HEADERS,
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: buildCsp("'none'") },
];

const LANDING_LAB_HEADERS = [
  ...BASE_HEADERS,
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Content-Security-Policy', value: buildCsp("'self'") },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  async headers() {
    return [
      {
        source: '/landing-lab.html',
        headers: LANDING_LAB_HEADERS,
      },
      {
        // Catch-all that excludes /landing-lab.html so we don't emit duplicate
        // X-Frame-Options / CSP headers for the iframe's static document.
        source: '/:path((?!landing-lab\\.html$).*)',
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
