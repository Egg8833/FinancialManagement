import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        // Service Worker 必須每次重新驗證,否則瀏覽器可能沿用舊版 sw.js
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/chart',
        destination: '/',
        permanent: true,
      },
      {
        source: '/annual',
        destination: '/cashflow',
        permanent: true,
      },
      {
        source: '/staking',
        destination: '/debt',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
