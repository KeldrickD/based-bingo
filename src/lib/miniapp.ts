// Mini App detection and safe haptics wrappers
import { sdk } from '@farcaster/frame-sdk';

function getSdk(): any {
  try {
    return sdk as any;
  } catch {
    return undefined;
  }
}

export function isMiniApp(): boolean {
  try {
    // Basic heuristics: running in iframe or known UA + sdk present
    const inFrame = typeof window !== 'undefined' && window.self !== window.top;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const hasSdk = !!getSdk();
    return hasSdk && (inFrame || /Farcaster|Warpcast/i.test(ua));
  } catch {
    return false;
  }
}

export function supportsHaptics(): boolean {
  const s = getSdk();
  return !!(s && s.haptics && (s.haptics.notification || s.haptics.impact));
}

export function hapticsNotify(kind: 'success' | 'warning' | 'error' = 'success'): void {
  try {
    const s = getSdk();
    if (s?.haptics?.notification) {
      s.haptics.notification(kind);
    } else if (s?.haptics?.impact) {
      s.haptics.impact(kind === 'success' ? 'medium' : 'light');
    }
  } catch {}
}

export function hapticsImpact(level: 'light' | 'medium' | 'heavy' = 'light'): void {
  try {
    const s = getSdk();
    if (s?.haptics?.impact) {
      s.haptics.impact(level);
    }
  } catch {}
}


