import { NextResponse } from 'next/server';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: 'operational' | 'degraded' | 'down';
    blockchain: 'operational' | 'degraded' | 'down';
    paymaster: 'operational' | 'degraded' | 'down' | 'disabled';
    analytics: 'operational' | 'degraded' | 'down';
  };
  contracts: {
    gameContract: string;
    tokenContract: string;
    network: string;
  };
  performance: {
    responseTime: number;
    memoryUsage?: NodeJS.MemoryUsage;
  };
}

// Check blockchain connectivity
async function checkBlockchain(): Promise<'operational' | 'degraded' | 'down'> {
  try {
    const rpcUrl = process.env.NEXT_PUBLIC_CDP_RPC || 'https://mainnet.base.org';
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1,
      }),
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.result ? 'operational' : 'degraded';
    }
    return 'degraded';
  } catch (error) {
    console.error('Blockchain health check failed:', error);
    return 'down';
  }
}

// Check paymaster status
async function checkPaymaster(): Promise<'operational' | 'degraded' | 'down' | 'disabled'> {
  const cdpRpc = process.env.NEXT_PUBLIC_CDP_RPC;
  
  if (!cdpRpc) {
    return 'disabled';
  }
  
  try {
    const response = await fetch(cdpRpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1,
      }),
      signal: AbortSignal.timeout(5000),
    });
    
    return response.ok ? 'operational' : 'degraded';
  } catch (error) {
    console.error('Paymaster health check failed:', error);
    return 'down';
  }
}

// Test analytics endpoint
async function checkAnalytics(): Promise<'operational' | 'degraded' | 'down'> {
  try {
    // Simple test of analytics endpoint
    const response = await fetch('/api/analytics', {
      method: 'GET',
      signal: AbortSignal.timeout(3000),
    });
    
    return response.ok ? 'operational' : 'degraded';
  } catch {
    return 'down';
  }
}

export async function GET(): Promise<NextResponse<HealthStatus>> {
  const startTime = Date.now();
  
  try {
    // Perform health checks in parallel
    const [blockchainStatus, paymasterStatus, analyticsStatus] = await Promise.all([
      checkBlockchain(),
      checkPaymaster(),
      checkAnalytics(),
    ]);
    
    const responseTime = Date.now() - startTime;
    
    // Determine overall status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (blockchainStatus === 'down') {
      overallStatus = 'unhealthy';
    } else if (
      blockchainStatus === 'degraded' || 
      paymasterStatus === 'degraded' || 
      analyticsStatus === 'degraded'
    ) {
      overallStatus = 'degraded';
    }
    
    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime?.() || 0,
      version: '2.0.0',
      environment: process.env.VERCEL_ENV || 'development',
      services: {
        database: 'operational', // We're using in-memory storage
        blockchain: blockchainStatus,
        paymaster: paymasterStatus,
        analytics: analyticsStatus,
      },
      contracts: {
        gameContract: '0x36Fb73233f8BB562a80fcC3ab9e6e011Cfe091f5',
        tokenContract: '0xd5D90dF16CA7b11Ad852e3Bf93c0b9b774CEc047',
        network: 'Base Mainnet',
      },
      performance: {
        responseTime,
        memoryUsage: process.memoryUsage?.(),
      },
    };
    
    // Log health check
    console.log('HEALTH_CHECK:', {
      status: overallStatus,
      responseTime,
      services: healthStatus.services,
    });
    
    // Return appropriate HTTP status code
    const httpStatus = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;
    
    return NextResponse.json(healthStatus, { status: httpStatus });
    
  } catch (error) {
    console.error('Health check failed:', error);
    
    const errorStatus: HealthStatus = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime?.() || 0,
      version: '2.0.0',
      environment: process.env.VERCEL_ENV || 'development',
      services: {
        database: 'down',
        blockchain: 'down',
        paymaster: 'down',
        analytics: 'down',
      },
      contracts: {
        gameContract: '0x36Fb73233f8BB562a80fcC3ab9e6e011Cfe091f5',
        tokenContract: '0xd5D90dF16CA7b11Ad852e3Bf93c0b9b774CEc047',
        network: 'Base Mainnet',
      },
      performance: {
        responseTime: Date.now() - startTime,
      },
    };
    
    return NextResponse.json(errorStatus, { status: 503 });
  }
} 