import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
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
