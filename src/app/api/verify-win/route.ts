import { NextRequest, NextResponse } from 'next/server';
import { keccak256, stringToHex } from 'viem';

// Mock private key for development - replace with secure key management in production
const MOCK_PRIVATE_KEY = process.env.WIN_SIGNER_PRIVATE_KEY || 'mock_dev_key';

export async function POST(request: NextRequest) {
  try {
    const { address, winTypes } = await request.json();

    if (!address || !winTypes || !Array.isArray(winTypes)) {
      return NextResponse.json(
        { error: 'Missing required fields: address, winTypes' },
        { status: 400 }
      );
    }

    // Generate deterministic hash for the win
    const winData = `${address}-${winTypes.join('-')}-${Date.now()}`;
    const hash = keccak256(stringToHex(winData));

    // In production, this would use the actual private key to sign
    // For now, return a mock signature
    const signature = '0x' + '1'.repeat(128); // 64 bytes placeholder

    console.log(`Win verification requested for ${address}: ${winTypes.join(', ')}`);
    console.log(`Generated hash: ${hash}`);

    return NextResponse.json({
      success: true,
      hash,
      signature,
      winData: {
        address,
        winTypes,
        timestamp: Date.now()
      }
    });

  } catch (error) {
    console.error('Win verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify win' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Win verification API - POST required',
    usage: 'POST with { address, winTypes }'
  });
} 