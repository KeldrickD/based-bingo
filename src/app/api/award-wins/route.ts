import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

// Complete BingoGameV3 ABI - you should replace this with the full ABI from your compiled contract
const bingoGameV3ABI = [
  {
    "inputs": [],
    "name": "join",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "buyUnlimited", 
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "player", "type": "address"},
      {"internalType": "string[]", "name": "winTypes", "type": "string[]"}
    ],
    "name": "awardWins",
    "outputs": [],
    "stateMutability": "nonpayable", 
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getConfig",
    "outputs": [
      {"internalType": "address", "name": "_owner", "type": "address"},
      {"internalType": "uint256", "name": "_rewardPerWin", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getGameStats",
    "outputs": [
      {"internalType": "uint256", "name": "_totalGamesPlayed", "type": "uint256"},
      {"internalType": "uint256", "name": "_contractBalance", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "oracle", "type": "address"}
    ],
    "name": "isAuthorizedOracle",
    "outputs": [
      {"internalType": "bool", "name": "", "type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // Add other functions as needed for debugging
  {
    "inputs": [],
    "name": "owner",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  }
];

const GAME_ADDRESS = '0x4CE879376Dc50aBB1Eb8F236B76e8e5a724780Be';
const BASE_RPC_URL = 'https://mainnet.base.org';

function normalizeWinTypes(winTypes: string[]): string[] {
  return winTypes.map((t) => {
    const s = t.toLowerCase().replace(/[^a-z]/g, '');
    if (s.includes('double')) return 'DOUBLE_LINE';
    if (s.includes('fullhouse') || s.includes('fullcard')) return 'FULL_HOUSE';
    if (s.includes('line')) return 'LINE';
    return t.toUpperCase();
  });
}

// Health check endpoint
export async function GET() {
  console.log('🏥 Award-wins health check called');
  
  try {
    const hasOwnerKey = !!process.env.OWNER_PRIVATE_KEY;
    const ownerKeyLength = process.env.OWNER_PRIVATE_KEY?.length;
    
    let ownerAddress = 'Not available';
    let networkStatus = 'Not tested';
    let balanceInfo = 'Not checked';
    
    if (hasOwnerKey) {
      try {
        const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
        const signer = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY!, provider);
        ownerAddress = signer.address;
        
        const balance = await provider.getBalance(signer.address);
        const balanceEth = ethers.formatEther(balance);
        balanceInfo = `${balanceEth} ETH`;
        networkStatus = 'Connected';
      } catch (error: any) {
        networkStatus = `Error: ${error.message}`;
      }
    }
    
    return NextResponse.json({
      status: 'healthy',
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        hasOwnerPrivateKey: hasOwnerKey,
        ownerKeyLength: ownerKeyLength ? `${ownerKeyLength} characters` : 'Not set',
        ownerAddress,
        networkStatus,
        ownerBalance: balanceInfo,
        gameContractAddress: GAME_ADDRESS,
        rpcUrl: BASE_RPC_URL
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('🚀 Award-wins API called at:', new Date().toISOString());
  console.log('🌍 Environment check:', {
    NODE_ENV: process.env.NODE_ENV,
    hasOwnerKey: !!process.env.OWNER_PRIVATE_KEY,
    baseRpcUrl: BASE_RPC_URL,
    gameAddress: GAME_ADDRESS
  });
  
  try {
    // Parse and validate request body
    const requestBody = await request.json();
    const { address, winTypes } = requestBody as { address: string; winTypes: string[] };
    
    const normalized = normalizeWinTypes(winTypes || []);
    // Prepare alternative normalizations in case contract expects different enum casing/order
    const normalizationCandidates: string[][] = [];
    // original normalized
    normalizationCandidates.push(normalized);
    // uppercase variants
    normalizationCandidates.push((winTypes || []).map((t: string) => t.toUpperCase().replace(/[^A-Z_]/g, '')));
    // safe mapped set
    const safeMap: Record<string, string> = {
      'line bingo!': 'LINE',
      'line': 'LINE',
      'double line!': 'DOUBLE_LINE',
      'double line': 'DOUBLE_LINE',
      'full house!': 'FULL_HOUSE',
      'full house': 'FULL_HOUSE',
      'full card': 'FULL_HOUSE',
    };
    normalizationCandidates.push((winTypes || []).map((t: string) => safeMap[t.toLowerCase()] || t.toUpperCase()));

    console.log('📋 Request details:', {
      address: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'undefined',
      winTypes,
      normalized,
      winTypesLength: winTypes?.length,
      requestBody: JSON.stringify(requestBody)
    });

    // Validate input
    if (!address || !winTypes || !Array.isArray(winTypes) || winTypes.length === 0) {
      console.error('❌ Invalid request body:', { address: !!address, winTypes, winTypesArray: Array.isArray(winTypes) });
      return NextResponse.json(
        { success: false, message: 'Invalid request data: address and winTypes array required' },
        { status: 400 }
      );
    }

    // Validate address format
    if (!ethers.isAddress(address)) {
      console.error('❌ Invalid address format:', address);
      return NextResponse.json(
        { success: false, message: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    // Check for owner private key
    const ownerPrivateKey = process.env.OWNER_PRIVATE_KEY;
    if (!ownerPrivateKey) {
      console.error('❌ CRITICAL: OWNER_PRIVATE_KEY not set in environment variables');
      return NextResponse.json(
        { success: false, message: 'Server configuration error: missing owner key' },
        { status: 500 }
      );
    }

    console.log('🔧 Environment check passed - private key available');

    // Set up provider and signer
    console.log('🌐 Connecting to Base mainnet...');
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const signer = new ethers.Wallet(ownerPrivateKey, provider);
    
    console.log('👛 Signer address:', signer.address);
    
    // Verify network connection and get owner balance
    try {
      const network = await provider.getNetwork();
      const balance = await provider.getBalance(signer.address);
      const balanceEth = ethers.formatEther(balance);
      
      console.log('🌐 Network connection verified:', {
        chainId: network.chainId.toString(),
        name: network.name,
        ownerBalance: `${balanceEth} ETH`,
        balanceWei: balance.toString()
      });

      if (parseFloat(balanceEth) < 0.001) {
        console.error('❌ CRITICAL: Owner wallet has insufficient ETH for gas!');
        return NextResponse.json(
          { success: false, message: `Owner wallet low on ETH: ${balanceEth} ETH (need ~0.001+ ETH for gas)` },
          { status: 500 }
        );
      }
    } catch (networkError: any) {
      console.error('❌ Network connection failed:', networkError);
      return NextResponse.json(
        { success: false, message: 'Network connection failed: ' + networkError.message },
        { status: 503 }
      );
    }
    
    // Create contract instance
    console.log('📋 Creating contract instance...');
    const contract = new ethers.Contract(GAME_ADDRESS, bingoGameV3ABI, signer);
    // Also prepare a 3-arg ABI variant for probing if needed
    const bingoGameV3ABI_3ARG = [
      { "inputs": [], "name": "join", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
      { "inputs": [], "name": "buyUnlimited", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
      { "inputs": [
          {"internalType": "address", "name": "player", "type": "address"},
          {"internalType": "string[]", "name": "winTypes", "type": "string[]"},
          {"internalType": "uint256", "name": "gameId", "type": "uint256"}
        ], "name": "awardWins", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
      { "inputs": [], "name": "owner", "outputs": [{"internalType": "address", "name": "", "type": "address"}], "stateMutability": "view", "type": "function" }
    ];
    const contract3 = new ethers.Contract(GAME_ADDRESS, bingoGameV3ABI_3ARG, signer);

    // Try to read contract owner for diagnostics ONLY (do not enforce)
    let contractOwner: string | null = null;
    // Diagnostic holders
    let diagConfig: { owner?: string; rewardPerWinEth?: string } = {};
    let diagStats: { totalGamesPlayed?: string; contractBalanceEth?: string } = {};
    let diagIsOracleAuthorized: boolean | undefined = undefined;
    let diagProbeReason: string | undefined = undefined;
    try {
      contractOwner = await contract.owner();
      console.log('🏛️ Contract owner (diagnostic):', contractOwner);
    } catch (ownerCheckError: any) {
      console.warn('⚠️ Could not read contract owner (function may not exist):', ownerCheckError.message);
    }

    // Deep diagnostics requested: config, stats, oracle authorization, and dry-run award
    try {
      // getConfig
      const config: any = await (contract as any).getConfig();
      try {
        const cfgOwner = config?._owner ?? config?.[0];
        const cfgRewardPerWin = config?._rewardPerWin ?? config?.[1];
        const rewardEth = cfgRewardPerWin ? ethers.formatUnits(cfgRewardPerWin, 18) : undefined;
        diagConfig = { owner: cfgOwner, rewardPerWinEth: rewardEth };
        console.log('🧩 Config:', { owner: cfgOwner, rewardPerWin: rewardEth });
      } catch {}
    } catch (e: any) {
      console.warn('⚠️ getConfig() not available or failed:', e?.message);
    }

    try {
      // getGameStats
      const stats: any = await (contract as any).getGameStats();
      try {
        const totalGamesPlayed = stats?._totalGamesPlayed ?? stats?.[0];
        const contractBalance = stats?._contractBalance ?? stats?.[1];
        const totalStr = totalGamesPlayed ? totalGamesPlayed.toString() : undefined;
        const balanceEth = contractBalance ? ethers.formatUnits(contractBalance, 18) : undefined;
        diagStats = { totalGamesPlayed: totalStr, contractBalanceEth: balanceEth };
        console.log('📈 GameStats:', { totalGamesPlayed: totalStr, contractBalance: balanceEth });
      } catch {}
    } catch (e: any) {
      console.warn('⚠️ getGameStats() not available or failed:', e?.message);
    }

    try {
      const authorized = await (contract as any).isAuthorizedOracle(signer.address);
      diagIsOracleAuthorized = authorized;
      console.log('🔐 isAuthorizedOracle(signer):', authorized);
    } catch (e: any) {
      console.warn('⚠️ isAuthorizedOracle() not available or failed:', e?.message);
    }

    // Preflight with staticCall to capture revert reasons before sending a tx
    console.log('🧪 Preflight: staticCall awardWins to detect reverts early...');
    // Additional explicit callStatic check with common inputs to surface revert reasons clearly
    try {
      const probeTypes = ['LINE'];
      // ethers v6: callStatic is under .staticCall for Contract? We already use .staticCall above.
      // Use the same interface for consistency; if it fails, error.reason will be logged below.
      await (contract as any).awardWins.staticCall(address, probeTypes);
      console.log('🧪 Probe call (LINE) would succeed');
    } catch (probeErr: any) {
      diagProbeReason = probeErr?.reason || probeErr?.message;
      console.warn('⚠️ Probe call (LINE) would revert:', diagProbeReason);
    }
    // Also probe a 3-arg variant with a default gameId of 1
    try {
      await (contract3 as any).awardWins.staticCall(address, ['LINE'], 1);
      console.log('🧪 Probe call 3-arg (LINE, gameId=1) would succeed');
    } catch (probeErr3: any) {
      console.warn('⚠️ Probe call 3-arg (LINE, gameId=1) would revert:', probeErr3?.reason || probeErr3?.message);
    }
    let chosenNormalized: string[] | null = null;
    let chosenVariant: '2' | '3' | null = null;
    const defaultGameId = 1;
    let lastPreflightError: any = null;
    for (const candidate of normalizationCandidates) {
      // Try 3-arg variant first
      try {
        await (contract3 as any).awardWins.staticCall(address, candidate, defaultGameId);
        chosenNormalized = candidate;
        chosenVariant = '3';
        console.log('🧪 Preflight success with 3-arg candidate:', candidate, 'gameId=', defaultGameId);
        break;
      } catch (e3: any) {
        lastPreflightError = e3;
        console.warn('⚠️ Preflight 3-arg candidate failed:', candidate, e3?.message);
      }
      // Fallback to 2-arg variant
      try {
        await (contract as any).awardWins.staticCall(address, candidate);
        chosenNormalized = candidate;
        chosenVariant = '2';
        console.log('🧪 Preflight success with 2-arg candidate:', candidate);
        break;
      } catch (e2: any) {
        lastPreflightError = e2;
        console.warn('⚠️ Preflight 2-arg candidate failed:', candidate, e2?.message);
      }
    }
    // If none passed, wait briefly and retry once (to allow recent join() to finalize)
    if (!chosenNormalized) {
      console.log('⏳ Waiting 4s then retrying preflight once...');
      await new Promise((r) => setTimeout(r, 4000));
      for (const candidate of normalizationCandidates) {
        try {
          await (contract3 as any).awardWins.staticCall(address, candidate, defaultGameId);
          chosenNormalized = candidate;
          chosenVariant = '3';
          console.log('🧪 Preflight success on retry with 3-arg candidate:', candidate, 'gameId=', defaultGameId);
          break;
        } catch (e3: any) {
          lastPreflightError = e3;
          console.warn('⚠️ Retry preflight 3-arg candidate failed:', candidate, e3?.message);
        }
        try {
          await (contract as any).awardWins.staticCall(address, candidate);
          chosenNormalized = candidate;
          chosenVariant = '2';
          console.log('🧪 Preflight success on retry with 2-arg candidate:', candidate);
          break;
        } catch (e2: any) {
          lastPreflightError = e2;
          console.warn('⚠️ Retry preflight 2-arg candidate failed:', candidate, e2?.message);
        }
      }
    }
    if (!chosenNormalized) {
      console.error('❌ Preflight failed (awardWins would revert):', lastPreflightError?.message);
      return NextResponse.json(
        {
          success: false,
          message: 'awardWins would revert - not sending transaction',
          details: lastPreflightError?.message,
          diagnostic: {
            contractOwner,
            signerAddress: signer.address,
            player: address,
            winTypes,
            normalized,
            config: diagConfig,
            stats: diagStats,
            isAuthorizedOracle: diagIsOracleAuthorized,
            probeReason: diagProbeReason,
            chosenVariant,
            gameIdUsed: defaultGameId,
          },
        },
        { status: 400 }
      );
    }

    // Estimate gas for the transaction
    console.log('⛽ Estimating gas for awardWins transaction...');
    let gasEstimate;
    try {
      gasEstimate = chosenVariant === '3'
        ? await (contract3 as any).awardWins.estimateGas(address, chosenNormalized, defaultGameId)
        : await (contract as any).awardWins.estimateGas(address, chosenNormalized);
      console.log('⛽ Gas estimate:', gasEstimate.toString());
    } catch (gasError: any) {
      console.error('❌ Gas estimation failed:', gasError.message);
      console.error('❌ Gas estimation error details:', {
        code: gasError.code,
        reason: gasError.reason,
        data: gasError.data
      });
      return NextResponse.json(
        { success: false, message: 'Gas estimation failed: ' + gasError.message, diagnostic: { normalized } },
        { status: 500 }
      );
    }

    // Call awardWins function
    console.log('📞 Calling awardWins on contract...');
    const txParams = {
      gasLimit: Math.max(Number(gasEstimate) * 2, 200000), // Use 2x estimate with minimum 200k
    };
    console.log('📞 Transaction parameters:', txParams);
    
    const tx = chosenVariant === '3'
      ? await (contract3 as any).awardWins(address, chosenNormalized, defaultGameId, txParams)
      : await (contract as any).awardWins(address, chosenNormalized, txParams);
    
    console.log('⏳ Transaction submitted:', {
      hash: tx.hash,
      nonce: tx.nonce,
      gasLimit: tx.gasLimit?.toString(),
      gasPrice: tx.gasPrice?.toString()
    });
    
    // Wait for confirmation
    console.log('⏳ Waiting for transaction confirmation...');
    const receipt = await tx.wait();
    
    const processingTime = Date.now() - startTime;
    const totalRewards = 1000 * normalized.length;
    
    console.log('✅ Transaction confirmed successfully:', {
      hash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed?.toString(),
      status: receipt.status,
      processingTimeMs: processingTime
    });

    console.log(`🎉 Successfully awarded ${totalRewards} $BINGO (${normalized.join(' + ')}) to ${address}`);

    return NextResponse.json({
      success: true,
      message: `Rewards sent: ${normalized.join(' + ')}`,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      winTypes: normalized,
      playerAddress: address,
      totalRewards,
      gasUsed: receipt.gasUsed?.toString(),
      processingTimeMs: processingTime,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    console.error('❌ Award wins FAILED after', processingTime, 'ms');
    console.error('❌ Error details:', {
      message: error.message,
      code: error.code,
      reason: error.reason,
      data: error.data,
      stack: error.stack?.split('\n').slice(0, 10) // First 10 lines of stack
    });
    
    let errorMessage = 'Unknown error occurred';
    let statusCode = 500;

    if (error.message?.includes('insufficient funds')) {
      errorMessage = 'Insufficient ETH for gas fees in owner wallet';
      statusCode = 500;
    } else if (error.message?.includes('execution reverted')) {
      errorMessage = 'Contract execution failed - possible duplicate claim or contract issue';
      statusCode = 400;
    } else if (error.message?.includes('network') || error.message?.includes('connection')) {
      errorMessage = 'Network connection error - please try again';
      statusCode = 503;
    } else if (error.message?.includes('nonce too low')) {
      errorMessage = 'Transaction nonce error - please try again';
      statusCode = 429;
    } else if (error.message?.includes('replacement transaction underpriced')) {
      errorMessage = 'Transaction replacement error - please wait and try again';
      statusCode = 429;
    } else if (error.message?.includes('timeout')) {
      errorMessage = 'Transaction timeout - may still be processing';
      statusCode = 408;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      {
        success: false,
        message: 'Failed to award wins',
        details: errorMessage,
        errorCode: error.code,
        errorReason: error.reason,
        processingTimeMs: processingTime,
        timestamp: new Date().toISOString(),
      },
      { status: statusCode }
    );
  }
} 