import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  // Next injects inline bootstrap/theme scripts; dev tooling may use eval.
  // Razorpay loads its hosted checkout script; Stripe checkout is a redirect.
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://checkout.razorpay.com https://js.stripe.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  // Web Speech API recognition is routed through Google's speech service;
  // the reachability probe also needs it. Google APIs only — no script/style loosening.
  `connect-src 'self' https://*.google.com https://*.googleapis.com https://*.gstatic.com https://api.razorpay.com https://lumberjack.razorpay.com https://api.stripe.com`,
  // Checkout iframes (Razorpay modal, Stripe hosted checkout fallback).
  `frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://api.stripe.com https://checkout.stripe.com`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
