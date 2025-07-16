import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Webhook received:', body); // Log events (e.g., user wins, casts)
    
    // Handle different webhook events
    switch (body.type) {
      case 'cast':
        console.log('Cast event:', body.data);
        // Handle cast events (e.g., when someone shares their Bingo win)
        break;
      case 'user_action':
        console.log('User action:', body.data);
        // Handle user actions (e.g., game completion, wallet connection)
        break;
      default:
        console.log('Unknown webhook type:', body.type);
    }
    
    // Later: Send Farcaster notifications or process game events
    // Example: Notify users when they win, track game statistics, etc.
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

export async function GET() {
  // Health check endpoint
  return NextResponse.json({ status: 'ok', message: 'Based Bingo webhook endpoint' });
} 