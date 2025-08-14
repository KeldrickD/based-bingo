import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Based Bingo",
  description: "Play Based Bingo and win $BINGO on Base.",
  other: {
    // Farcaster/Warpcast friendly CSP for frames
    "Content-Security-Policy": [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https: data:",
      "img-src 'self' data: https:",
      "font-src 'self' data: https:",
      "connect-src 'self' https://farcaster.xyz https://client.farcaster.xyz https://warpcast.com https://client.warpcast.com https://wrpcd.net https://*.wrpcd.net https://privy.farcaster.xyz https://privy.warpcast.com https://auth.privy.io https://*.rpc.privy.systems https://cloudflareinsights.com https://mainnet.base.org https://*.base.org https://api.basescan.org https://*.coinbase.com https://api.developer.coinbase.com https://*.coinbasewallet.com https://*.onchainkit.xyz",
      "frame-ancestors 'self' https://warpcast.com https://farcaster.xyz",
      "frame-src 'self' https://warpcast.com https://farcaster.xyz",
      "worker-src 'self' blob:",
    ].join('; '),
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
