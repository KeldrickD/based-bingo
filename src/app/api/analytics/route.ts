import { NextRequest, NextResponse } from 'next/server';

interface AnalyticsEvent {
  event: 'game_started' | 'game_completed' | 'win_detected' | 'win_claimed' | 'unlimited_purchased' | 'error_occurred';
  player?: string; // Privacy-friendly (first 6 + last 4 chars)
  data?: Record<string, unknown>;
  timestamp: string;
  sessionId?: string;
  userAgent?: string;
  environment: string;
}

interface GameAnalytics {
  totalGames: number;
  totalWins: number;
  winRate: number;
  averageGameDuration: number;
  popularWinTypes: Record<string, number>;
  errorCount: number;
  unlimitedPurchases: number;
  lastUpdated: string;
}

// In-memory analytics storage (in production, use a proper database)
let analyticsData: AnalyticsEvent[] = [];
const gameAnalytics: GameAnalytics = {
  totalGames: 0,
  totalWins: 0,
  winRate: 0,
  averageGameDuration: 0,
  popularWinTypes: {},
  errorCount: 0,
  unlimitedPurchases: 0,
  lastUpdated: new Date().toISOString(),
};

// Privacy-friendly player ID
function anonymizePlayer(address: string): string {
  if (!address || address.length < 10) return 'anonymous';
  return address.slice(0, 6) + '...' + address.slice(-4);
}

// Update analytics aggregates
function updateAnalytics(event: AnalyticsEvent) {
  switch (event.event) {
    case 'game_started':
      gameAnalytics.totalGames++;
      break;
    
    case 'win_detected':
      gameAnalytics.totalWins++;
      if (event.data?.winTypes && Array.isArray(event.data.winTypes)) {
        event.data.winTypes.forEach((winType: string) => {
          gameAnalytics.popularWinTypes[winType] = (gameAnalytics.popularWinTypes[winType] || 0) + 1;
        });
      }
      break;
    
    case 'unlimited_purchased':
      gameAnalytics.unlimitedPurchases++;
      break;
    
    case 'error_occurred':
      gameAnalytics.errorCount++;
      break;
  }
  
  // Calculate win rate
  if (gameAnalytics.totalGames > 0) {
    gameAnalytics.winRate = (gameAnalytics.totalWins / gameAnalytics.totalGames) * 100;
  }
  
  gameAnalytics.lastUpdated = new Date().toISOString();
}

// Log event for monitoring
function logEvent(event: AnalyticsEvent) {
  console.log('GAME_ANALYTICS:', JSON.stringify({
    ...event,
    player: event.player ? anonymizePlayer(event.player) : undefined,
  }));
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { event, player, data, sessionId } = body;

    // Validate required fields
    if (!event) {
      return NextResponse.json({
        success: false,
        error: 'Event type is required',
      }, { status: 400 });
    }

    // Create analytics event
    const analyticsEvent: AnalyticsEvent = {
      event,
      player: player ? anonymizePlayer(player) : undefined,
      data: data || {},
      timestamp: new Date().toISOString(),
      sessionId,
      userAgent: request.headers.get('user-agent') || undefined,
      environment: process.env.VERCEL_ENV || 'development',
    };

    // Store event (in production, save to database)
    analyticsData.push(analyticsEvent);
    
    // Keep only last 1000 events in memory
    if (analyticsData.length > 1000) {
      analyticsData = analyticsData.slice(-1000);
    }

    // Update aggregated analytics
    updateAnalytics(analyticsEvent);
    
    // Log for monitoring
    logEvent(analyticsEvent);

    return NextResponse.json({
      success: true,
      message: 'Analytics event recorded',
      eventId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    });

  } catch (error) {
    console.error('ANALYTICS_ERROR:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to record analytics event',
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get('timeframe') || '24h';
    const detailed = searchParams.get('detailed') === 'true';

    // Calculate timeframe filter
    const now = new Date();
    const filterDate = new Date();
    
    switch (timeframe) {
      case '1h':
        filterDate.setHours(now.getHours() - 1);
        break;
      case '24h':
        filterDate.setDate(now.getDate() - 1);
        break;
      case '7d':
        filterDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        filterDate.setDate(now.getDate() - 30);
        break;
      default:
        filterDate.setDate(now.getDate() - 1);
    }

    // Filter events by timeframe
    const filteredEvents = analyticsData.filter(event => 
      new Date(event.timestamp) >= filterDate
    );

    // Calculate metrics for the timeframe
    const metrics = {
      timeframe,
      totalEvents: filteredEvents.length,
      gamesStarted: filteredEvents.filter(e => e.event === 'game_started').length,
      winsDetected: filteredEvents.filter(e => e.event === 'win_detected').length,
      winsClaimed: filteredEvents.filter(e => e.event === 'win_claimed').length,
      unlimitedPurchases: filteredEvents.filter(e => e.event === 'unlimited_purchased').length,
      errors: filteredEvents.filter(e => e.event === 'error_occurred').length,
      uniquePlayers: new Set(filteredEvents.map(e => e.player).filter(Boolean)).size,
      winClaimSuccessRate: 0,
      popularWinTypes: {} as Record<string, number>,
    };

    // Calculate win claim success rate
    if (metrics.winsDetected > 0) {
      metrics.winClaimSuccessRate = (metrics.winsClaimed / metrics.winsDetected) * 100;
    }

    // Calculate popular win types in timeframe
    filteredEvents
      .filter(e => e.event === 'win_detected' && e.data?.winTypes)
      .forEach(e => {
        if (e.data && Array.isArray(e.data.winTypes)) {
          (e.data.winTypes as string[]).forEach((winType: string) => {
            metrics.popularWinTypes[winType] = (metrics.popularWinTypes[winType] || 0) + 1;
          });
        }
      });

    const response: any = {
      metrics,
      aggregated: gameAnalytics,
      system: {
        environment: process.env.VERCEL_ENV || 'development',
        uptime: process.uptime?.() || 0,
        timestamp: new Date().toISOString(),
      },
    };

    // Optionally include current weekly challenge info
    try {
      const includeChallenge = searchParams.get('challenge') === '1';
      if (includeChallenge) {
        const { getCurrentChallenge, getWeekKey } = await import('@/lib/challenges');
        response.currentChallenge = getCurrentChallenge();
        response.weekKey = getWeekKey();
      }
    } catch {}

    // Include detailed events if requested
    if (detailed) {
      (response as typeof response & { events: AnalyticsEvent[] }).events = filteredEvents.slice(-100); // Last 100 events
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('ANALYTICS_FETCH_ERROR:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch analytics data',
    }, { status: 500 });
  }
} 