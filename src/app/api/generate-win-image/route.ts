import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const winType = searchParams.get('type') || 'line';
  const count = searchParams.get('count') || '1';

  // For now, return a simple SVG-based image
  // In production, you'd generate a proper image with the actual card state
  const svg = `
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#0052FF;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#0033CC;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="1200" height="630" fill="url(#bg)"/>
      <text x="600" y="200" font-family="Arial, sans-serif" font-size="72" font-weight="bold" text-anchor="middle" fill="white">🎉 BINGO! 🎉</text>
      <text x="600" y="300" font-family="Arial, sans-serif" font-size="48" font-weight="bold" text-anchor="middle" fill="white">${winType.toUpperCase()} WIN!</text>
      <text x="600" y="380" font-family="Arial, sans-serif" font-size="32" text-anchor="middle" fill="white">Won ${count} $BINGO tokens</text>
      <text x="600" y="450" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="white">Play Based Bingo on Base</text>
      <text x="600" y="580" font-family="Arial, sans-serif" font-size="18" text-anchor="middle" fill="white">basedbingo.xyz</text>
    </svg>
  `;

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
} 