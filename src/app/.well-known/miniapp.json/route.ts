import { NextResponse } from 'next/server';
import { buildFarcasterManifest } from '../farcaster.json/route';

export async function GET() {
  // Mirror Farcaster manifest for generic Mini App discovery
  return NextResponse.json(buildFarcasterManifest());
}


