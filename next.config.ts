import type { NextConfig } from "next";

/**
 * Security headers applied to every response.
 *
 * CSP is intentionally pragmatic — Clerk and Stripe both inject inline scripts
 * and connect to their own domains. We allow them explicitly. If you tighten
 * this further (e.g. drop 'unsafe-eval'), test the dashboard end-to-end first
 * because Next.js dev tooling can break.
 */
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://*.clerk.com https://clerk.riverzai.com https://js.stripe.com https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://*.kie.ai https://*.googleusercontent.com https://*.cloudfront.net https://*.amazonaws.com https://*.elevenlabs.io https://riverzai.com https://cdn.riverzai.com https://placehold.co",
      "media-src 'self' blob: https://*.supabase.co https://*.supabase.in https://*.kie.ai https://*.cloudfront.net https://*.amazonaws.com",
      "connect-src 'self' https://*.clerk.accounts.dev https://*.clerk.com https://clerk.riverzai.com https://api.stripe.com https://*.supabase.co https://*.supabase.in wss://*.supabase.co https://api.kie.ai https://api.elevenlabs.io https://api.openai.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join('; '),
  },
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
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default nextConfig;
