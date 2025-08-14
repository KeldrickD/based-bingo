import { NextRequest, NextResponse } from 'next/server';

function decodeJwtPayload(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(payload, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Mini App verification endpoint' });
}

export async function POST(request: NextRequest) {
  try {
    const headerName = 'x-action-id-token';
    const token = request.headers.get(headerName) || request.headers.get(headerName.toUpperCase());

    if (!token) {
      return NextResponse.json(
        { success: false, message: 'Missing X-Action-Id-Token header' },
        { status: 401 }
      );
    }

    const claims = decodeJwtPayload(token) || {};
    const now = Math.floor(Date.now() / 1000);
    const isExpired = typeof claims.exp === 'number' && claims.exp < now;

    return NextResponse.json({
      success: true,
      tokenPresent: true,
      expired: isExpired,
      claims: {
        sub: claims.sub,
        aud: claims.aud,
        iss: claims.iss,
        exp: claims.exp,
        iat: claims.iat,
        wallet: claims.wallet,
        user: claims.user,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error?.message || 'Verification failed' }, { status: 500 });
  }
}


