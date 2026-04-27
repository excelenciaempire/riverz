import { auth, currentUser } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const KIE_API_KEY = process.env.KIE_API_KEY!;
const KIE_BASE_URL = 'https://api.kie.ai';

async function isAdmin(userEmail: string): Promise<boolean> {
  const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
  return adminEmails.includes(userEmail.toLowerCase());
}

export async function GET() {
  try {
    const { userId } = await auth();
    const user = await currentUser();

    if (!userId || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userEmail = user.emailAddresses[0]?.emailAddress;
    if (!userEmail || !(await isAdmin(userEmail))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch Kie.ai credit balance
    const response = await fetch(`${KIE_BASE_URL}/api/v1/chat/credit`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${KIE_API_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Kie.ai API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.code !== 200) {
      throw new Error(data.msg || 'Failed to fetch balance');
    }

    // Return balance with some calculated metrics
    const balance = data.data;
    
    // Estimate generations remaining (approximate costs)
    const estimates = {
      static_ads: Math.floor(balance / 5), // ~5 credits per image
      ugc_videos: Math.floor(balance / 50), // ~50 credits per video
      face_swaps: Math.floor(balance / 30), // ~30 credits per face swap
    };

    return NextResponse.json({
      success: true,
      balance,
      estimates,
      provider: 'Kie.ai',
      lastChecked: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Error fetching Kie.ai balance:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch balance' },
      { status: 500 }
    );
  }
}
