'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useAccount, useConnect, useDisconnect, useReconnect } from 'wagmi';
import { base } from 'wagmi/chains';

function isBaseAppEnvironment() {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const eth = (window as any).ethereum;
  return /Base|CoinbaseWallet|Coinbase/i.test(ua) || !!eth?.isCoinbaseWallet || !!eth?.isBaseWallet;
}

function labelForConnector(id: string, name: string) {
  if (id === 'baseAccount') return 'Base Account';
  if (id === 'injected') return 'In-app wallet';
  if (id.includes('coinbase')) return 'Coinbase Wallet';
  if (id.includes('farcaster')) return 'Farcaster';
  return name;
}

export default function WalletConnectionPanel() {
  const attemptedAutoConnect = useRef(false);
  const { address, isConnected, status } = useAccount();
  const { connectors, connect, error, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { reconnect } = useReconnect();

  const orderedConnectors = useMemo(() => {
    const score = (id: string) => {
      if (id === 'injected') return 0;
      if (id === 'baseAccount') return 1;
      if (id.includes('coinbase')) return 2;
      if (id.includes('farcaster')) return 3;
      return 4;
    };
    return [...connectors].sort((a, b) => score(a.id) - score(b.id));
  }, [connectors]);

  useEffect(() => {
    if (attemptedAutoConnect.current || isConnected || connectors.length === 0) return;
    attemptedAutoConnect.current = true;

    reconnect();

    if (!isBaseAppEnvironment()) return;

    const preferred =
      connectors.find((connector) => connector.id === 'injected') ||
      connectors.find((connector) => connector.id === 'baseAccount') ||
      connectors.find((connector) => connector.id.toLowerCase().includes('coinbase'));

    if (preferred) {
      connect({ connector: preferred, chainId: base.id });
    }
  }, [connect, connectors, isConnected, reconnect]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white/90 p-3 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-950">Wallet</div>
          <div className="mt-1 text-slate-600">
            {isConnected && address ? `${address.slice(0, 6)}...${address.slice(-4)}` : status === 'connecting' ? 'Connecting...' : 'Auto-connects in Base App'}
          </div>
        </div>
        {isConnected ? (
          <button
            type="button"
            onClick={() => disconnect()}
            className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-400"
          >
            Disconnect
          </button>
        ) : null}
      </div>

      {!isConnected && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {orderedConnectors.slice(0, 4).map((connector) => (
            <button
              key={connector.uid}
              type="button"
              disabled={isPending}
              onClick={() => connect({ connector, chainId: base.id })}
              className="rounded-md bg-coinbase-blue px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {labelForConnector(connector.id, connector.name)}
            </button>
          ))}
        </div>
      )}

      {error && <div className="mt-2 text-xs text-red-600">{error.message.slice(0, 180)}</div>}
    </div>
  );
}
