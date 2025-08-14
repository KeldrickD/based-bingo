import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline' https: data:",
            "img-src 'self' data: https:",
            "font-src 'self' data: https:",
            "connect-src 'self' https://farcaster.xyz https://client.farcaster.xyz https://warpcast.com https://client.warpcast.com https://wrpcd.net https://*.wrpcd.net https://privy.farcaster.xyz https://privy.warpcast.com https://auth.privy.io https://*.rpc.privy.systems https://cloudflareinsights.com https://mainnet.base.org https://*.base.org https://api.basescan.org https://*.coinbase.com https://api.developer.coinbase.com https://*.coinbasewallet.com https://*.onchainkit.xyz https://api.farcaster.xyz https://auth.farcaster.xyz",
            "frame-ancestors 'self' https://warpcast.com https://farcaster.xyz",
            "frame-src 'self' https://warpcast.com https://farcaster.xyz",
            "worker-src 'self' blob:",
          ].join('; '),
        },
      ],
    },
  ],
};

export default nextConfig;
