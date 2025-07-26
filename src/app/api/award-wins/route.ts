import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

// ABI for the awardWins function
const bingoGameABI = [
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

    console.log('🎯 Auto-awarding wins:', { address, winTypes });

    // Set up provider and signer
    const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);
    const signer = new ethers.Wallet(ownerPrivateKey, provider);
    
    // Create contract instance
    const contract = new ethers.Contract(GAME_ADDRESS, bingoGameABI, signer);

    // Call awardWins function
    console.log('📞 Calling awardWins on contract...');
    const tx = await contract.awardWins(address, winTypes);
    
    console.log('⏳ Transaction submitted:', tx.hash);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    console.log('✅ Transaction confirmed:', receipt.hash);

    // Track success
    console.log(`✅ Successfully awarded ${winTypes.join(' + ')} to ${address}`);

    return NextResponse.json({
      success: true,
      message: `Rewards sent: ${winTypes.join(' + ')}`,
      transactionHash: receipt.hash,
      winTypes,
      address
    });

  } catch (error: any) {
    console.error('❌ Award wins failed:', error);
    
    let errorMessage = 'Unknown error occurred';
    let statusCode = 500;

    if (error.message?.includes('insufficient funds')) {
      errorMessage = 'Insufficient ETH for gas fees in owner wallet';
    } else if (error.message?.includes('execution reverted')) {
      errorMessage = 'Contract execution failed - possible duplicate claim';
    } else if (error.message?.includes('network')) {
      errorMessage = 'Network connection error';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      {
        error: 'Failed to award wins',
        details: errorMessage,
      },
      { status: statusCode }
    );
  }
} 