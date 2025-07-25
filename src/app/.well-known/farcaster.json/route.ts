import { NextResponse } from 'next/server';

export async function GET() {
  const manifest = {
    miniapp: {
      version: "1",
      name: "Based Bingo",
      subtitle: "Bingo game with token wins",
      description: "A fun, free Bingo game native to Farcaster and Coinbase Wallet. Mark your card, draw numbers, and win mock BINGO - real payouts coming soon on Base!",
      primaryCategory: "games",
      screenshotUrls: [
              "https://basedbingo.xyz/screenshot1.png",
      "https://basedbingo.xyz/screenshot2.png"
      ],
          imageUrl: "https://basedbingo.xyz/preview.png",
    heroImageUrl: "https://basedbingo.xyz/hero.png",
    splashImageUrl: "https://basedbingo.xyz/splash.png",
      splashBackgroundColor: "#0052FF",
      tags: ["bingo", "games", "base", "crypto", "onchain"],
      tagline: "Play Bingo win real BINGO now",
      buttonTitle: "Play Based Bingo",
      ogTitle: "Based Bingo Onchain Fun",
      ogDescription: "Draw numbers, mark your card, and shout BINGO! Free play now, token wins coming.",
      ogImageUrl: "https://basedbingo.xyz/og-image.png",
      castShareUrl: "https://basedbingo.xyz/share",
      homeUrl: "https://basedbingo.xyz",
      webhookUrl: "https://basedbingo.xyz/api/webhook",
      requiredChains: ["eip155:8453"],
      iconUrl: "https://basedbingo.xyz/icon.png"
    },
    accountAssociation: {
      header: "eyJmaWQiOjEwNDUwNDIsInR5cGUiOiJhdXRoIiwia2V5IjoiMHgyZTM3MkEyNzFkQjI3NWNlMDRDOTdkM2RlNWZBMUIzM0QzZUJFNmRFIn0",
      payload: "eyJkb21haW4iOiJiYXNlZGJpbmdvLnh5eiJ9",
      signature: "r+PRsIWuo4wnxoxWcnlfVzEY9OkD9KGGk7Mj+Nm7BDoN2UjsYUnPEnETdld5M2SS5bbAhPF7028NsK3o4iHtyBw="
    }
  };
  
  return NextResponse.json(manifest);
} 