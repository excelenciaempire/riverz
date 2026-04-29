import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const KIE_API_KEY = process.env.KIE_API_KEY!;
const KIE_ENDPOINT = 'https://api.kie.ai/gemini-3-pro/v1/chat/completions';

const SYS = `Eres un copywriter experto en ecommerce colombiano de skincare.
Producto: Kit Vitalu = Crema de sebo de res purificado Grass-Fed + Jabon Exotico de regalo.
Ingredientes: sebo de res, acido hialuronico, aceite de coco, manteca de cacao, vitamina E, omega 3.
Garantia 30 dias. Fabricado en Medellin. Target: mujeres 25-45 que probaron todo sin resultados.
Dado un ANGULO de venta, genera todo el copy adaptado. Tono: emocional, colombiano, directo.
Responde SOLO con JSON valido sin markdown. Claves exactas:
hero-l1,hero-l2,hero-em,hero-sub,pq-text,pq-cite,dolor-p1,dolor-p2,stat-1,stat-2,stat-3,vill-p1,vill-p2,vill-p3,rev-p1,rev-p2,rev-p3,rev-pq,rev-p4,rev-p5,prod-desc,prod-p1,ing-1-name,ing-1-desc,ing-2-name,ing-2-desc,ing-3-name,ing-3-desc,ing-4-name,ing-4-desc,ing-5-name,ing-5-desc,ing-6-name,ing-6-desc,tl-1,tl-2,tl-3,tl-4,tl-5,t1-body,t1-name,t1-city,t2-body,t2-name,t2-city,t3-body,t3-name,t3-city,gift-title,gift-p1,gift-p2,gift-note,gtee-title,gtee-body,cta-title,cta-sub,cta-btn,cta-meta,ck-1,ck-2,ck-3,ck-4,ck-5,ck-6`;

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { angle, name } = await req.json();

    const response = await fetch(KIE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${KIE_API_KEY}`,
      },
      body: JSON.stringify({
        max_tokens: 4000,
        stream: false,
        messages: [
          { role: 'system', content: [{ type: 'text', text: SYS }] },
          { role: 'user', content: [{ type: 'text', text: `ANGULO: ${angle}\nNOMBRE: ${name}` }] },
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data.error?.message || 'KIE API error' }, { status: response.status });
    }

    const text = data.choices?.[0]?.message?.content ?? '';
    return NextResponse.json({ text });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal error' }, { status: 500 });
  }
}
