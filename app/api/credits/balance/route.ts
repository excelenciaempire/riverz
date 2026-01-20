import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const KIE_API_KEY = process.env.KIE_API_KEY || '174d2ff19987520a25ecd1ed9c3ccc2b';
const KIE_BASE_URL = 'https://api.kie.ai';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch Kie.ai credit balance
    const response = await fetch(`${KIE_BASE_URL}/api/v1/chat/credit`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${KIE_API_KEY}`,
      },
      // Cache for 10 seconds to avoid too many API calls
      next: { revalidate: 10 }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.code !== 200) {
      throw new Error(data.msg || 'Failed to fetch balance');
    }

    return NextResponse.json({
      credits: data.data,
      lastUpdated: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Error fetching credits:', error);
    return NextResponse.json(
      { credits: 0, error: error.message },
      { status: 200 } // Return 200 with 0 credits on error
    );
  }
}
