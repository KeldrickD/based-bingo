# CDP Base Paymaster Setup for Based Bingo

## Overview
Based Bingo is now configured to support gasless transactions through Coinbase Developer Platform's Base Paymaster. This allows users to play and claim wins without paying gas fees.

## Prerequisites
1. **CDP Account**: Sign up at [portal.cdp.coinbase.com](https://portal.cdp.coinbase.com)
2. **API Key**: Get your API key from the CDP dashboard
3. **Base Network**: Paymaster only works on Base Mainnet and Base Sepolia

## Configuration Steps

### 1. Get CDP API Key
- Visit: `portal.cdp.coinbase.com`
- Navigate: **Onchain Tools → Paymaster → Base Mainnet**
- Copy your RPC URL (format: `https://api.developer.coinbase.com/rpc/v1/base/YOUR_API_KEY`)

### 2. Environment Variable
Add to your `.env.local` file:
```env
NEXT_PUBLIC_CDP_RPC=https://api.developer.coinbase.com/rpc/v1/base/YOUR_API_KEY_HERE
```

### 3. Paymaster Whitelist Configuration
In your CDP dashboard, whitelist the following:

**Contract Address:**
```
0x36Fb73233f8BB562a80fcC3ab9e6e011Cfe091f5
```

**Functions to Whitelist:**
- `join` - For game entry fees
- `buyUnlimited` - For unlimited play purchases  
- `claimWin` - For reward claiming

### 4. Smart Contract Addresses

**Game Contract (BingoGameV2):**
- Address: `0x36Fb73233f8BB562a80fcC3ab9e6e011Cfe091f5`
- Network: Base Mainnet

**Token Contract ($BINGO):**
- Address: `0xd5D90dF16CA7b11Ad852e3Bf93c0b9b774CEc047`
- Network: Base Mainnet

## Paymaster Limits & Rules

### Daily Limits (Per User)
- **Maximum**: $0.05 USD worth of gas per user per day
- **Operations**: 1 UserOperation maximum per user per day
- **Reset**: Limits reset daily at midnight UTC

### Wallet Requirements
- **ERC-4337 Compliant**: Must use ERC-4337 compatible wallet
- **Coinbase Wallet**: ✅ Fully supported
- **Other Wallets**: Check ERC-4337 compatibility

### Network Support
- **Base Mainnet**: ✅ Supported
- **Base Sepolia**: ✅ Supported  
- **Other Networks**: ❌ Not supported

## How It Works

### Without Paymaster (Current Default)
```
User → Pays Gas → Transaction → On-Chain
```

### With Paymaster (When Configured)
```
User → Free Transaction → CDP Paymaster → Pays Gas → On-Chain
```

## Implementation Status

### ✅ Ready Features
- **Wagmi Config**: Updated to use CDP RPC endpoint
- **Fallback System**: Auto-fallback to regular Base RPC
- **Environment Detection**: Automatically detects if paymaster is configured

### 🚧 In Development
- **useWriteContracts**: Experimental API temporarily disabled due to TypeScript compatibility
- **Batch Transactions**: Sequential fallback implemented for unlimited purchases

### 🎯 Future Enhancements
- **Real Signature Generation**: Replace mock signatures with actual cryptographic signing
- **Advanced Error Handling**: Better user feedback for paymaster failures
- **Analytics**: Track gasless transaction success rates

## Testing Instructions

### 1. Without Paymaster (Default)
- Users pay gas fees normally
- All transactions work as expected
- No special configuration needed

### 2. With Paymaster (After Setup)
- Add `NEXT_PUBLIC_CDP_RPC` environment variable
- Deploy changes to production
- Users get gasless transactions (within limits)
- Fallback to paid gas if paymaster fails

## Troubleshooting

### Common Issues

**"Transaction Failed" Errors:**
- Check if user exceeded daily limits ($0.05 USD / 1 operation)
- Verify contract address is whitelisted
- Ensure function names are properly whitelisted

**Paymaster Not Working:**
- Verify `NEXT_PUBLIC_CDP_RPC` is set correctly
- Check CDP dashboard for API key status
- Confirm wallet is ERC-4337 compatible

**Signature Verification Failures:**
- Current system uses mock signatures for development
- Production will need real cryptographic signatures
- Backend API `/api/verify-win` handles signature generation

## Production Checklist

- [ ] CDP API key configured
- [ ] Environment variable set: `NEXT_PUBLIC_CDP_RPC`
- [ ] Contract addresses whitelisted in CDP dashboard
- [ ] Functions whitelisted: `join`, `buyUnlimited`, `claimWin`
- [ ] Real signature generation implemented (replace mock system)
- [ ] User education on gasless transaction limits
- [ ] Monitoring setup for paymaster success rates

## Support

For CDP Paymaster issues:
- [CDP Documentation](https://docs.cdp.coinbase.com)
- [CDP Discord](https://discord.com/invite/cdp)

For Based Bingo specific issues:
- Check console logs for transaction details
- Verify wallet connection to Base network
- Test with both gasless and regular transactions

---

**Note**: The paymaster integration is optional. Based Bingo works perfectly without it, users just pay normal gas fees. When configured, it provides a better user experience with free transactions within the daily limits. 