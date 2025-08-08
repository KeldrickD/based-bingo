import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

// BingoGameV3 ABI (broadened to support multiple awardWins signatures)
const bingoGameV3ABI = [
  { inputs: [], name: 'join', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'buyUnlimited', outputs: [], stateMutability: 'nonpayable', type: 'function' },

  // string[] variants
  { inputs: [
      { internalType: 'address', name: 'player', type: 'address' },
      { internalType: 'string[]', name: 'winTypes', type: 'string[]' }
    ], name: 'awardWins', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [
      { internalType: 'address', name: 'player', type: 'address' },
      { internalType: 'string[]', name: 'winTypes', type: 'string[]' },
      { internalType: 'uint256', name: 'gameId', type: 'uint256' }
    ], name: 'awardWins', outputs: [], stateMutability: 'nonpayable', type: 'function' },

  // bytes32[] variants
  { inputs: [
      { internalType: 'address', name: 'player', type: 'address' },
      { internalType: 'bytes32[]', name: 'winTypes', type: 'bytes32[]' }
    ], name: 'awardWins', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [
      { internalType: 'address', name: 'player', type: 'address' },
      { internalType: 'bytes32[]', name: 'winTypes', type: 'bytes32[]' },
      { internalType: 'uint256', name: 'gameId', type: 'uint256' }
    ], name: 'awardWins', outputs: [], stateMutability: 'nonpayable', type: 'function' },

  // uint8[] variants (enum indices)
  { inputs: [
      { internalType: 'address', name: 'player', type: 'address' },
      { internalType: 'uint8[]', name: 'winTypes', type: 'uint8[]' }
    ], name: 'awardWins', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [
      { internalType: 'address', name: 'player', type: 'address' },
      { internalType: 'uint8[]', name: 'winTypes', type: 'uint8[]' },
      { internalType: 'uint256', name: 'gameId', type: 'uint256' }
    ], name: 'awardWins', outputs: [], stateMutability: 'nonpayable', type: 'function' },

  // Diagnostics helpers
  { inputs: [], name: 'owner', outputs: [{ internalType: 'address', name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getConfig', outputs: [
      { internalType: 'address', name: '_owner', type: 'address' },
      { internalType: 'uint256', name: '_rewardPerWin', type: 'uint256' }
    ], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getGameStats', outputs: [
      { internalType: 'uint256', name: '_totalGamesPlayed', type: 'uint256' },
      { internalType: 'uint256', name: '_contractBalance', type: 'uint256' }
    ], stateMutability: 'view', type: 'function' },
  { inputs: [
      { internalType: 'uint256', name: 'gameId', type: 'uint256' },
      { internalType: 'address', name: 'player', type: 'address' },
      { internalType: 'bytes32', name: 'winKey', type: 'bytes32' }
    ], name: 'hasClaimedWin', outputs: [{ internalType: 'bool', name: '', type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ internalType: 'address', name: 'oracle', type: 'address' }], name: 'isAuthorizedOracle', outputs: [{ internalType: 'bool', name: '', type: 'bool' }], stateMutability: 'view', type: 'function' },
];

const GAME_ADDRESS = (process.env.GAME_ADDRESS as string) || '0x88eAbBdD2158D184f4cB1C39B612eABB48289907';
const BASE_RPC_URL = 'https://mainnet.base.org';

function normalizeWinTypesToStrings(winTypes: string[]): string[] {
  return (winTypes || []).map((t) => {
    const s = t.toLowerCase().replace(/[^a-z]/g, '');
    if (s.includes('double')) return 'DOUBLE_LINE';
    if (s.includes('fullhouse') || s.includes('fullcard')) return 'FULL_HOUSE';
    if (s.includes('line')) return 'LINE';
    return t.toUpperCase();
  });
}

function mapWinTypesToEnumIndices(normalized: string[]): number[] {
  const map: Record<string, number> = { LINE: 0, DOUBLE_LINE: 1, FULL_HOUSE: 2 };
  return normalized.map((t) => (map[t] ?? 0));
}

function mapWinTypesToBytes32(normalized: string[]): string[] {
  return normalized.map((t) => ethers.id(t));
}

// Health check endpoint
export async function GET() {
  try {
    const hasOwnerKey = !!process.env.OWNER_PRIVATE_KEY;
    let ownerAddress = 'Not available';
    let networkStatus = 'Not tested';
    let balanceInfo = 'Not checked';

    if (hasOwnerKey) {
      const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
      const signer = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY!, provider);
      ownerAddress = signer.address;
      const balance = await provider.getBalance(signer.address);
      balanceInfo = `${ethers.formatEther(balance)} ETH`;
      networkStatus = 'Connected';
    }

    return NextResponse.json({
      status: 'healthy',
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        hasOwnerPrivateKey: hasOwnerKey,
        ownerAddress,
        networkStatus,
        ownerBalance: balanceInfo,
        gameContractAddress: GAME_ADDRESS,
        rpcUrl: BASE_RPC_URL,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  try {
    const requestBody = await request.json();
    const { address, winTypes, gameId, dryRun } = requestBody as { address: string; winTypes: string[]; gameId?: number; dryRun?: boolean };

    if (!address || !winTypes || !Array.isArray(winTypes) || winTypes.length === 0) {
      return NextResponse.json({ success: false, message: 'Invalid request data: address and winTypes array required' }, { status: 400 });
    }
    if (!ethers.isAddress(address)) {
      return NextResponse.json({ success: false, message: 'Invalid wallet address format' }, { status: 400 });
    }

    const ownerPrivateKey = process.env.OWNER_PRIVATE_KEY;
    if (!ownerPrivateKey) {
      return NextResponse.json({ success: false, message: 'Server configuration error: missing owner key' }, { status: 500 });
    }

    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const signer = new ethers.Wallet(ownerPrivateKey, provider);
    const contract = new ethers.Contract(GAME_ADDRESS, bingoGameV3ABI, signer) as any;

    // Diagnostics: oracle authorization
    let isOracle = false;
    try { isOracle = await contract.isAuthorizedOracle(signer.address); } catch {}

    // Normalize to 3 encodings
    const normalizedStrings = normalizeWinTypesToStrings(winTypes);
    const normalizedBytes32 = mapWinTypesToBytes32(normalizedStrings);
    const normalizedUint8 = mapWinTypesToEnumIndices(normalizedStrings);
    const chosenGameId = typeof gameId === 'number' && gameId > 0 ? gameId : 1;

    type Variant = { label: string; sig: string; args: any[] };
    const variants: Variant[] = [
      // Prefer 2-arg signatures first so contract can determine session/game context internally
      { label: 'str2',  sig: 'awardWins(address,string[])',         args: [address, normalizedStrings] },
      { label: 'bytes2',sig: 'awardWins(address,bytes32[])',        args: [address, normalizedBytes32] },
      { label: 'uint2', sig: 'awardWins(address,uint8[])',          args: [address, normalizedUint8] },
      // Try 3-arg variants with requested gameId
      { label: 'str3',  sig: 'awardWins(address,string[],uint256)', args: [address, normalizedStrings, chosenGameId] },
      { label: 'bytes3',sig: 'awardWins(address,bytes32[],uint256)',args: [address, normalizedBytes32, chosenGameId] },
      { label: 'uint3', sig: 'awardWins(address,uint8[],uint256)',  args: [address, normalizedUint8, chosenGameId] },
      // Final fallback: try with gameId=1 if original gameId fails
      ...(chosenGameId !== 1 ? [
        { label: 'str3_fallback',  sig: 'awardWins(address,string[],uint256)', args: [address, normalizedStrings, 1] },
        { label: 'bytes3_fallback',sig: 'awardWins(address,bytes32[],uint256)',args: [address, normalizedBytes32, 1] },
        { label: 'uint3_fallback', sig: 'awardWins(address,uint8[],uint256)',  args: [address, normalizedUint8, 1] },
      ] : [])
    ];

    // Preflight to find a working variant
    let selected: Variant | null = null;
    let lastError: any = null;
    for (const v of variants) {
      try {
        await (contract as any)[v.sig].staticCall(...v.args);
        selected = v; break;
      } catch (e: any) {
        lastError = e;
      }
    }

    if (!selected) {
      return NextResponse.json({ success: false, message: 'awardWins would revert - not sending transaction', details: lastError?.message, diagnostic: { normalizedStrings, normalizedUint8, normalizedBytes32, chosenGameId, isAuthorizedOracle: isOracle, signer: signer.address } }, { status: 400 });
    }

    if (dryRun) {
      return NextResponse.json({ success: true, message: 'Preflight success (dry run)', selectedVariant: selected.label, selectedSignature: selected.sig, args: selected.args, isAuthorizedOracle: isOracle, signer: signer.address });
    }

    // Estimate gas and send
    let gasEstimate;
    try {
      gasEstimate = await (contract as any)[selected.sig].estimateGas(...selected.args);
    } catch (gasError: any) {
      return NextResponse.json({ success: false, message: 'Gas estimation failed', details: gasError?.message, variant: selected.label, signature: selected.sig, isAuthorizedOracle: isOracle, signer: signer.address }, { status: 500 });
    }

    const tx = await (contract as any)[selected.sig](...selected.args, { gasLimit: Math.max(Number(gasEstimate) * 2, 200_000) });
    const receipt = await tx.wait();

    const processingTime = Date.now() - startTime;
    const totalRewards = 1000 * normalizedStrings.length;

    return NextResponse.json({ success: true, message: `Rewards sent: ${normalizedStrings.join(' + ')}`, transactionHash: receipt.hash, blockNumber: receipt.blockNumber, playerAddress: address, totalRewards, processingTimeMs: processingTime, selectedVariant: selected.label, selectedSignature: selected.sig, isAuthorizedOracle: isOracle, signer: signer.address });
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    return NextResponse.json({ success: false, message: 'Failed to award wins', details: error?.message, processingTimeMs: processingTime }, { status: 500 });
  }
} 