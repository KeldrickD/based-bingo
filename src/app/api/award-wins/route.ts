import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

// BingoGameV3 ABI
const bingoGameV3ABI = [
  {
    "inputs": [
      {"internalType": "address", "name": "player", "type": "address"},
      {"internalType": "string[]", "name": "winTypes", "type": "string[]"}
    ],
    "name": "awardWins",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const GAME_ADDRESS = '0x4CE879376Dc50aBB1Eb8F236B76e8e5a724780Be';
const BASE_RPC_URL = 'https://mainnet.base.org';

export async function POST(request: NextRequest) {
  try {
    const { address, winTypes } = await request.json();

    // Validate input
    if (!address || !winTypes || !Array.isArray(winTypes) || winTypes.length === 0) {
      return NextResponse.json(
        { error: 'Invalid input: address and winTypes array required' },
        { status: 400 }
      );
    }

    // Validate address format
    if (!ethers.isAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    // Check for owner private key
    const ownerPrivateKey = process.env.OWNER_PRIVATE_KEY;
    if (!ownerPrivateKey) {
      console.error('❌ OWNER_PRIVATE_KEY not set in environment variables');
      return NextResponse.json(
        { error: 'Server configuration error: missing owner key' },
        { status: 500 }
      );
    }

    console.log('🎯 Auto-awarding wins:', { 
      address: `${address.slice(0, 6)}...${address.slice(-4)}`, 
      winTypes,
      timestamp: new Date().toISOString()
    });

    // Set up provider and signer
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const signer = new ethers.Wallet(ownerPrivateKey, provider);
    
    // Verify signer has ETH for gas
    const balance = await provider.getBalance(signer.address);
    console.log('👛 Owner wallet balance:', ethers.formatEther(balance), 'ETH');
    
    if (balance < ethers.parseEther('0.001')) {
      console.error('❌ Owner wallet has insufficient ETH for gas');
      return NextResponse.json(
        { error: 'Server error: insufficient gas funds' },
        { status: 500 }
      );
    }
    
    // Create contract instance
    const contract = new ethers.Contract(GAME_ADDRESS, bingoGameV3ABI, signer);

    // Call awardWins function
    console.log('📞 Calling awardWins on contract...');
    const tx = await contract.awardWins(address, winTypes, {
      gasLimit: 200000, // Set reasonable gas limit
    });
    
    console.log('⏳ Transaction submitted:', tx.hash);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    console.log('✅ Transaction confirmed in block:', receipt.blockNumber);

    // Calculate rewards
    const totalRewards = 1000 * winTypes.length;
    console.log(`✅ Successfully awarded ${totalRewards} $BINGO (${winTypes.join(' + ')}) to ${address}`);

    return NextResponse.json({
      success: true,
      message: `Rewards sent: ${winTypes.join(' + ')}`,
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      winTypes,
      playerAddress: address,
      totalRewards,
      gasUsed: receipt.gasUsed?.toString(),
    });

  } catch (error: any) {
    console.error('❌ Award wins failed:', error);
    
    let errorMessage = 'Unknown error occurred';
    let statusCode = 500;

    if (error.message?.includes('insufficient funds')) {
      errorMessage = 'Insufficient ETH for gas fees in owner wallet';
    } else if (error.message?.includes('execution reverted')) {
      errorMessage = 'Contract execution failed - possible duplicate claim or contract issue';
      statusCode = 400;
    } else if (error.message?.includes('network') || error.message?.includes('connection')) {
      errorMessage = 'Network connection error - please try again';
      statusCode = 503;
    } else if (error.message?.includes('nonce too low')) {
      errorMessage = 'Transaction nonce error - please try again';
      statusCode = 429;
    } else if (error.message) {
      errorMessage = error.message;
    }

    // Log detailed error for debugging
    console.error('📝 Detailed error info:', {
      message: error.message,
      code: error.code,
      reason: error.reason,
      transaction: error.transaction,
      stack: error.stack?.split('\n').slice(0, 5), // First 5 lines of stack
    });

    return NextResponse.json(
      {
        error: 'Failed to award wins',
        details: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: statusCode }
    );
  }
} 