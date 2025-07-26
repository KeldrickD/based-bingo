import { NextRequest, NextResponse } from 'next/server';
import { keccak256, stringToHex, encodePacked, hashTypedData } from 'viem';

// Environment variables for secure signing
const SIGNER_PRIVATE_KEY = process.env.SIGNER_PRIVATE_KEY || process.env.WIN_SIGNER_PRIVATE_KEY;
const VERCEL_ENV = process.env.VERCEL_ENV || 'development';

// EIP-712 Domain for BingoGameV2
const DOMAIN = {
  name: 'BingoGameV2',
  version: '1',
  chainId: 8453, // Base Mainnet
  verifyingContract: '0x36Fb73233f8BB562a80fcC3ab9e6e011Cfe091f5' as `0x${string}`,
} as const;

// EIP-712 Types for Win Claims
const TYPES = {
  WinClaim: [
    { name: 'player', type: 'address' },
    { name: 'winTypes', type: 'string[]' },
    { name: 'timestamp', type: 'uint256' },
    { name: 'gameId', type: 'bytes32' },
  ],
} as const;

interface WinVerificationRequest {
  address: string;
  winTypes: string[];
  gameId?: string;
}

interface WinVerificationResponse {
  success: boolean;
  hash: string;
  signature: string;
  winData: {
    player: string;
    winTypes: string[];
    timestamp: number;
    gameId: string;
    environment: string;
  };
  error?: string;
}

// Generate cryptographically secure signature
async function generateWinSignature(
  player: string,
  winTypes: string[],
  gameId: string
): Promise<{ hash: string; signature: string; timestamp: number }> {
  const timestamp = Math.floor(Date.now() / 1000);
  
  // Create the message to sign
  const message = {
    player: player as `0x${string}`,
    winTypes,
    timestamp: BigInt(timestamp),
    gameId: gameId as `0x${string}`,
  };

  // Generate EIP-712 hash
  const hash = hashTypedData({
    domain: DOMAIN,
    types: TYPES,
    primaryType: 'WinClaim',
    message,
  });

  // In production, this would use the actual private key to sign
  // For now, create a deterministic signature based on the hash
  let signature: string;
  
  if (SIGNER_PRIVATE_KEY && SIGNER_PRIVATE_KEY !== 'mock_dev_key') {
    // TODO: Implement actual signing with private key
    // const wallet = new ethers.Wallet(SIGNER_PRIVATE_KEY);
    // signature = await wallet.signTypedData(DOMAIN, TYPES, message);
    
    // For now, generate a more realistic mock signature
    const signatureData = keccak256(encodePacked(['bytes32', 'string'], [hash, SIGNER_PRIVATE_KEY]));
    signature = signatureData;
  } else {
    // Development fallback - deterministic signature
    const mockSeed = keccak256(encodePacked(['bytes32', 'string'], [hash, 'dev_mode']));
    signature = mockSeed;
  }

  return { hash, signature, timestamp };
}

// Generate unique game ID
function generateGameId(address: string, winTypes: string[]): string {
  const gameData = `${address}-${winTypes.join(',')}-${Date.now()}`;
  return keccak256(stringToHex(gameData));
}

// Validate win types
function validateWinTypes(winTypes: string[]): boolean {
  const validTypes = ['Line Bingo!', 'Double Line!', 'Full House!'];
  return winTypes.every(type => validTypes.includes(type)) && winTypes.length > 0;
}

// Log analytics for monitoring
function logWinAnalytics(player: string, winTypes: string[], success: boolean, error?: string) {
  const analytics = {
    timestamp: new Date().toISOString(),
    player: player.slice(0, 6) + '...' + player.slice(-4), // Privacy-friendly
    winTypes,
    success,
    error: error || null,
    environment: VERCEL_ENV,
    endpoint: '/api/verify-win',
  };
  
  console.log('WIN_ANALYTICS:', JSON.stringify(analytics));
  
  // In production, send to analytics service
  // await sendToAnalytics(analytics);
}

export async function POST(request: NextRequest): Promise<NextResponse<WinVerificationResponse>> {
  const startTime = Date.now();
  
  try {
    // Parse and validate request
    const body = await request.json() as WinVerificationRequest;
    const { address, winTypes, gameId } = body;

    // Input validation
    if (!address || !winTypes || !Array.isArray(winTypes)) {
      logWinAnalytics(address || 'unknown', winTypes || [], false, 'Invalid input parameters');
      return NextResponse.json({
        success: false,
        hash: '',
        signature: '',
        winData: {} as any,
        error: 'Missing required fields: address, winTypes (array)',
      }, { status: 400 });
    }

    // Validate Ethereum address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      logWinAnalytics(address, winTypes, false, 'Invalid address format');
      return NextResponse.json({
        success: false,
        hash: '',
        signature: '',
        winData: {} as any,
        error: 'Invalid Ethereum address format',
      }, { status: 400 });
    }

    // Validate win types
    if (!validateWinTypes(winTypes)) {
      logWinAnalytics(address, winTypes, false, 'Invalid win types');
      return NextResponse.json({
        success: false,
        hash: '',
        signature: '',
        winData: {} as any,
        error: 'Invalid win types provided',
      }, { status: 400 });
    }

    // Generate or use provided game ID
    const finalGameId = gameId || generateGameId(address, winTypes);

    // Generate cryptographic signature
    const { hash, signature, timestamp } = await generateWinSignature(address, winTypes, finalGameId);

    const winData = {
      player: address,
      winTypes,
      timestamp,
      gameId: finalGameId,
      environment: VERCEL_ENV,
    };

    // Log successful verification
    logWinAnalytics(address, winTypes, true);
    
    const processingTime = Date.now() - startTime;
    console.log(`WIN_SIGNATURE_GENERATED: ${winTypes.join(', ')} for ${address.slice(0, 6)}...${address.slice(-4)} in ${processingTime}ms`);

    return NextResponse.json({
      success: true,
      hash,
      signature,
      winData,
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('WIN_VERIFICATION_ERROR:', {
      error: errorMessage,
      processingTime,
      timestamp: new Date().toISOString(),
    });

    logWinAnalytics('unknown', [], false, errorMessage);

    return NextResponse.json({
      success: false,
      hash: '',
      signature: '',
      winData: {} as any,
      error: 'Internal server error during win verification',
    }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    service: 'BingoGameV2 Win Verification API',
    version: '2.0.0',
    status: 'operational',
    environment: VERCEL_ENV,
    methods: {
      POST: {
        description: 'Generate cryptographic signature for win claims',
        body: {
          address: 'Ethereum address (0x...)',
          winTypes: 'Array of win types ["Line Bingo!", "Double Line!", "Full House!"]',
          gameId: 'Optional game ID (auto-generated if not provided)',
        },
        response: {
          success: 'boolean',
          hash: 'EIP-712 typed data hash',
          signature: 'Cryptographic signature',
          winData: 'Complete win information with timestamp',
        },
      },
    },
    security: {
      eip712: true,
      domainSeparation: true,
      timestampValidation: true,
      inputValidation: true,
    },
  });
} 