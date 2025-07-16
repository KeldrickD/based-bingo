# Based Bingo 🎲

A fun, interactive Bingo game built for Farcaster and Coinbase Wallet integration. Play Bingo with a beautiful Coinbase blue design and prepare for future $BINGO token rewards!

## ✨ Features

### 🎮 **Core Gameplay**
- **Classic Bingo Rules**: 5x5 grid with proper number ranges (B:1-15, I:16-30, N:31-45, G:46-60, O:61-75)
- **FREE Space**: Center cell automatically marked with classic rotated styling
- **Unique Draws**: No duplicate numbers (tracks drawn numbers in a Set)
- **Win Detection**: Automatic detection of rows, columns, and diagonals
- **New Game**: Reset functionality to play again without refreshing

### 💼 **Wallet Integration**
- **Coinbase Wallet**: Seamless connection with Base network support
- **Address Display**: Shows truncated wallet address when connected
- **Future-Ready**: Prepared for $BINGO token airdrops and on-chain features

### 🎨 **Design & UX**
- **Coinbase Blue**: Beautiful branding with #0052FF color scheme
- **Responsive Design**: Optimized for Farcaster Mini Apps and mobile wallets
- **Smooth Animations**: Hover effects, transitions, and win celebrations
- **Hydration Safe**: Proper client-side rendering to prevent SSR issues

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Coinbase Wallet (for full experience)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/KeldrickD/based-bingo.git
   cd based-bingo
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🎯 How to Play

1. **Connect Wallet**: Click "Connect Wallet" to link your Coinbase Wallet
2. **Draw Numbers**: Click "Draw Number" to get random numbers (1-75)
3. **Mark Matches**: Click on cells that match the current drawn number
4. **Get BINGO**: Complete a row, column, or diagonal to win
5. **Play Again**: Click "New Game" to start fresh

## 🏗️ Tech Stack

- **Framework**: Next.js 15 with App Router
- **Styling**: Tailwind CSS v4 with custom Coinbase blue theme
- **Web3**: Wagmi v2 + Viem for wallet integration
- **Blockchain**: Base network (optimized for $BINGO token)
- **Language**: TypeScript for type safety

## 📁 Project Structure

```
based-bingo/
├── src/
│   ├── app/
│   │   ├── globals.css          # Tailwind styles + custom colors
│   │   ├── layout.tsx           # Root layout
│   │   └── page.tsx             # Main page with metadata
│   ├── components/
│   │   ├── BingoCard.tsx        # Main game component
│   │   └── WagmiWrapper.tsx     # Wallet provider wrapper
│   └── lib/
│       └── wagmi-config.ts      # Wagmi configuration
├── tailwind.config.ts           # Tailwind configuration
└── package.json                 # Dependencies and scripts
```

## 🚀 Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Deploy with default settings
3. Update the Farcaster Mini App URL in `src/app/page.tsx`
4. Add a preview image at `public/preview.png` (1200x630 recommended)

### Manual Deployment
```bash
npm run build
npm start
```

## 🔮 Future Features

- **$BINGO Token Integration**: Real token rewards for wins
- **Multiplayer Mode**: Shared draws across multiple players
- **NFT Rewards**: Collectible Bingo cards
- **Leaderboards**: Global and friend-based rankings
- **Social Features**: Share wins on Farcaster

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Farcaster**: For the amazing social protocol
- **Coinbase**: For the beautiful wallet and Base network
- **Next.js Team**: For the incredible React framework
- **Wagmi Team**: For the excellent Web3 hooks

---

**Ready to play?** Connect your wallet and start winning $BINGO tokens! 🎲✨
