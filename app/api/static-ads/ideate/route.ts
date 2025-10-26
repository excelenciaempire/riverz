import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { productId } = await req.json();

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    // Obtener el producto
    const { data: product, error: productError } = await supabaseAdmin
      .from('products')
      .select('*')
      .eq('id', productId)
      .eq('clerk_user_id', userId)
      .single();

    if (productError || !product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Verificar si ya existen conceptos generados para este producto
    const { data: existingConcepts } = await supabaseAdmin
      .from('ad_concepts')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (existingConcepts && existingConcepts.length > 0) {
      // Retornar conceptos existentes agrupados por awareness level
      const groupedConcepts = {
        unaware: existingConcepts.filter(c => c.awareness_level === 'unaware'),
        problem_aware: existingConcepts.filter(c => c.awareness_level === 'problem_aware'),
        solution_aware: existingConcepts.filter(c => c.awareness_level === 'solution_aware'),
      };

      return NextResponse.json({
        success: true,
        concepts: groupedConcepts,
        cached: true,
      });
    }

    // Si no existen, generar nuevos conceptos (simulados por ahora)
    // En producción, aquí se llamaría a N8N para generar con IA
    const newConcepts = [
      // Unaware
      {
        product_id: productId,
        awareness_level: 'unaware',
        headline: `Descubre ${product.name}`,
        description: `Una solución innovadora que está cambiando la forma en que las personas ${product.benefits?.split(',')[0] || 'resuelven sus problemas'}.`,
        hook: '¿Sabías que existe una mejor manera?',
        cta: 'Descubre Más',
      },
      {
        product_id: productId,
        awareness_level: 'unaware',
        headline: 'La Nueva Tendencia',
        description: `Miles de personas ya están usando ${product.name} para mejorar su vida diaria.`,
        hook: 'No te quedes atrás',
        cta: 'Ver Cómo Funciona',
      },
      // Problem Aware
      {
        product_id: productId,
        awareness_level: 'problem_aware',
        headline: '¿Cansado de [Problema]?',
        description: `${product.name} elimina ese dolor de cabeza de una vez por todas.`,
        hook: 'Sabemos exactamente cómo te sientes',
        cta: 'Solucionar Ahora',
      },
      {
        product_id: productId,
        awareness_level: 'problem_aware',
        headline: 'El Problema Que Todos Tienen',
        description: `Y ${product.name} es la respuesta que estabas buscando.`,
        hook: 'Ya no tienes que sufrir más',
        cta: 'Obtener Solución',
      },
      // Solution Aware
      {
        product_id: productId,
        awareness_level: 'solution_aware',
        headline: `${product.name} vs. La Competencia`,
        description: `Descubre por qué ${product.name} es la mejor opción del mercado.`,
        hook: 'Compara y decide',
        cta: 'Ver Comparación',
      },
      {
        product_id: productId,
        awareness_level: 'solution_aware',
        headline: 'La Mejor Inversión',
        description: `Por solo $${product.price}, obtén ${product.benefits?.split(',')[0] || 'resultados increíbles'}.`,
        hook: 'Calidad garantizada',
        cta: 'Comprar Ahora',
      },
    ];

    // Insertar conceptos en la base de datos
    const { data: insertedConcepts, error: insertError } = await supabaseAdmin
      .from('ad_concepts')
      .insert(newConcepts)
      .select();

    if (insertError) {
      console.error('Error inserting concepts:', insertError);
      throw insertError;
    }

    // Agrupar por awareness level
    const groupedConcepts = {
      unaware: insertedConcepts.filter(c => c.awareness_level === 'unaware'),
      problem_aware: insertedConcepts.filter(c => c.awareness_level === 'problem_aware'),
      solution_aware: insertedConcepts.filter(c => c.awareness_level === 'solution_aware'),
    };

    return NextResponse.json({
      success: true,
      concepts: groupedConcepts,
      cached: false,
    });

  } catch (error: any) {
    console.error('Error generating ad concepts:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate ad concepts' },
      { status: 500 }
    );
  }
}
