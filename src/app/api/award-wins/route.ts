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
    const { address, winTypes } = requestBody;
    
    console.log('📋 Request details:', {
      address: address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'undefined',
      winTypes,
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
    
    console.log('👛 Owner wallet address:', signer.address);
    
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
    console.log('📋 Contract instance created:', {
      address: contract.target,
      hasAwardWins: typeof contract.awardWins === 'function'
    });
    
    // Verify contract owner (optional debugging step)
    try {
      const contractOwner = await contract.owner();
      console.log('🏛️ Contract owner verification:', {
        contractOwner,
        signerAddress: signer.address,
        isOwner: contractOwner.toLowerCase() === signer.address.toLowerCase()
      });
      
      if (contractOwner.toLowerCase() !== signer.address.toLowerCase()) {
        console.error('❌ CRITICAL: Signer is not the contract owner!');
        return NextResponse.json(
          { success: false, message: 'Server error: unauthorized signer' },
          { status: 500 }
        );
      }
    } catch (ownerCheckError: any) {
      console.warn('⚠️ Could not verify contract owner (function may not exist):', ownerCheckError.message);
    }

    // Estimate gas for the transaction
    console.log('⛽ Estimating gas for awardWins transaction...');
    let gasEstimate;
    try {
      gasEstimate = await contract.awardWins.estimateGas(address, winTypes);
      console.log('⛽ Gas estimate:', gasEstimate.toString());
    } catch (gasError: any) {
      console.error('❌ Gas estimation failed:', gasError.message);
      console.error('❌ Gas estimation error details:', {
        code: gasError.code,
        reason: gasError.reason,
        data: gasError.data
      });
      return NextResponse.json(
        { success: false, message: 'Gas estimation failed: ' + gasError.message },
        { status: 500 }
      );
    }

    // Call awardWins function
    console.log('📞 Calling awardWins on contract...');
    const txParams = {
      gasLimit: Math.max(Number(gasEstimate) * 2, 200000), // Use 2x estimate with minimum 200k
    };
    console.log('📞 Transaction parameters:', txParams);
    
    const tx = await contract.awardWins(address, winTypes, txParams);
    
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
    const totalRewards = 1000 * winTypes.length;
    
    console.log('✅ Transaction confirmed successfully:', {
      hash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed?.toString(),
      status: receipt.status,
      processingTimeMs: processingTime
    });

    console.log(`🎉 Successfully awarded ${totalRewards} $BINGO (${winTypes.join(' + ')}) to ${address}`);

    return NextResponse.json({
      success: true,
      message: `Rewards sent: ${winTypes.join(' + ')}`,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      winTypes,
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