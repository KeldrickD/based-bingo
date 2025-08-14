# Based Bingo

A fun, free Bingo game native to Farcaster and Coinbase Wallet. Mark your card, draw numbers, and win mock $BINGO—real payouts coming soon on Base!

## 🎯 EIP-5792 Mini App Support

This app is fully compliant with **EIP-5792** (Wallet Connect for Mini Apps), enabling seamless wallet integration within:

- **Farcaster Mini Apps** (Warpcast, etc.)
- **Coinbase Wallet Mini Apps**
- **Any EIP-5792 compliant wallet environment**

### Key Features:
- ✅ **Native Wallet Connection**: Direct integration without redirects
- ✅ **Transaction Signing**: Ready for future $BINGO token transactions
- ✅ **Environment Detection**: Automatically detects Mini App environments
- ✅ **Fallback Support**: Works in both Mini App and regular browser environments

### Technical Implementation:
- Uses `@farcaster/miniapp-wagmi-connector` for EIP-5792 compliance
- Automatic environment detection for optimal user experience
- Fallback to Coinbase Wallet connector for non-Mini App environments
- Enhanced error handling for wallet connection scenarios

## 🎮 Features

- **Daily Limits**: 3 free games per day (resets at midnight UTC)
- **Auto-Draw**: Numbers drawn automatically every 3.5 seconds
- **Timer**: 2-minute countdown for each game
- **Multiple Wins**: Line, Double Line, and Full House wins
- **Farcaster Integration**: Share wins and get +1 play
- **Wallet Integration**: Connect wallet for future $BINGO rewards
- **Farcaster Mini App**: Native integration with Warpcast
- **OnchainKit**: Native Coinbase Wallet support

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/KeldrickD/based-bingo.git
   cd based-bingo
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file:
   ```
   # OnchainKit Configuration
   NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME=Based Bingo
   NEXT_PUBLIC_URL=https://basedbingo.xyz
   NEXT_PUBLIC_ONCHAINKIT_API_KEY=your-api-key-here
    NEXT_PUBLIC_BASE_APP_ID=your-base-app-id
    NEXT_PUBLIC_CDP_RPC=https://api.developer.coinbase.com/rpc/v1/base/YOUR_API_KEY_HERE
    REQUIRE_MINIAPP_AUTH=0
    # Public URL used as Mini App audience (must match deploy origin exactly)
    NEXT_PUBLIC_URL=https://basedbingo.xyz

   # Farcaster Account Association (from your manifest)
   FARCASTER_HEADER=eyJmaWQiOjEwNDUwNDIsInR5cGUiOiJhdXRoIiwia2V5IjoiMHgyZTM3MkEyNzFkQjI3NWNlMDRDOTdkM2RlNWZBMUIzM0QzZUJFNmRFIn0
   FARCASTER_PAYLOAD=eyJkb21haW4iOiJiYXNlZC1iaW5nby52ZXJjZWwuYXBwIn0
   FARCASTER_SIGNATURE=/EnNzL6KJD3o05tHyqm/CF/jz2CryQK88Br8UHF3BzcT0hzG8/+Rllh2C/bj3ohHI2eFjMijBkLbohdC7IQggRs=
   ```

4. **Get OnchainKit API Key**
   - Visit [onchainkit.xyz/dashboard](https://onchainkit.xyz/dashboard)
   - Create a new project for "Based Bingo"
   - Copy the API key to your `.env.local`

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🛠 Tech Stack

- **Next.js 15**: React framework with App Router
- **TypeScript**: Type safety throughout
- **Tailwind CSS**: Styling with custom Coinbase blue theme
- **Wagmi**: Wallet connection and interactions
- **Farcaster Mini App SDK**: In-app wallet connection and casting
- **OnchainKit**: Native Coinbase Wallet integration
- **@tanstack/react-query**: Data fetching and caching
- **html-to-image**: Client-side image generation for sharing

## 📁 Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout with providers
│   ├── page.tsx                # Main game page
│   ├── share/page.tsx          # Farcaster sharing page
│   ├── win/[winType]/page.tsx  # Dynamic win sharing pages
│   ├── .well-known/
│   │   └── farcaster.json/
│   │       └── route.ts        # Dynamic Farcaster manifest
│   └── api/
│       └── generate-win-image/
│           └── route.ts        # Win image generation API
├── components/
│   └── BingoCard.tsx           # Main game component
├── providers/
│   └── MiniKitProvider.tsx     # OnchainKit provider wrapper
└── lib/
    └── wagmi-config.ts         # Wagmi configuration with EIP-5792
```

## 🎯 Wallet Integration

### EIP-5792 Mini App Support
- **Farcaster Mini App Connector**: Primary connector for Mini App environments
- **Coinbase Wallet Connector**: Fallback for regular browser environments
- **Environment Detection**: Automatic detection of Mini App vs browser
- **Enhanced UX**: Different UI states for different environments

### Connection Flow
1. **Mini App Environment**: Uses Farcaster Mini App connector (EIP-5792)
2. **Browser Environment**: Falls back to Coinbase Wallet connector
3. **Error Handling**: Graceful fallback if connection fails
4. **Visual Feedback**: Clear indication of connection status

## 🚀 Deployment

### Vercel (Recommended)
1. **Connect Repository**: Link your GitHub repo to Vercel
2. **Environment Variables**: Add all variables from `.env.local`
3. **Deploy**: Automatic deployment on push to main branch

### Environment Variables for Production
```
NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME=Based Bingo
NEXT_PUBLIC_URL=https://basedbingo.xyz
NEXT_PUBLIC_ONCHAINKIT_API_KEY=your-production-api-key
    NEXT_PUBLIC_BASE_APP_ID=your-base-app-id
    NEXT_PUBLIC_CDP_RPC=https://api.developer.coinbase.com/rpc/v1/base/YOUR_API_KEY_HERE
    REQUIRE_MINIAPP_AUTH=1
    NEXT_PUBLIC_URL=https://basedbingo.xyz
FARCASTER_HEADER=your-farcaster-header
FARCASTER_PAYLOAD=your-farcaster-payload
FARCASTER_SIGNATURE=your-farcaster-signature
```

## 🎮 Game Rules

1. **Start Game**: Click "Start Game" to begin a 2-minute session
2. **Auto-Draw**: Numbers are drawn automatically every 3.5 seconds
3. **Mark Numbers**: Click on numbers that match recent draws
4. **Win Patterns**:
   - **Line**: Complete any row, column, or diagonal
   - **Double Line**: Complete 2+ lines
   - **Full House**: Complete 5+ lines
5. **Daily Limits**: 3 free games per day (resets at midnight UTC)
6. **Extra Plays**: Share on Farcaster for +1 play

## 🎯 Farcaster Integration

### Mini App Features
- **Native Embedding**: Runs directly within Warpcast
- **Wallet Connection**: Seamless in-app wallet integration
- **Casting**: Share wins and game progress
- **Frames**: Dynamic win sharing with custom metadata

### Sharing Features
- **Win Sharing**: Auto-generate Farcaster Frames for wins
- **Game Progress**: Share current game state
- **Rewards**: Get +1 play for sharing wins

## 🔮 Future Features

- **$BINGO Token Integration**: Real token rewards on Base
- **NFT Rewards**: Collectible Bingo cards
- **Leaderboards**: Global and friend-based rankings
- **Tournaments**: Scheduled competitive events
- **Social Features**: Friend challenges and team play

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Farcaster**: For the Mini App platform and SDK
- **Coinbase**: For OnchainKit and wallet integration
- **Base**: For the L2 network and ecosystem
- **Wagmi**: For excellent wallet integration tools
- **Next.js**: For the amazing React framework
