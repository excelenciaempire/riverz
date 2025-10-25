// MIDDLEWARE PARA PREVIEW SIN AUTENTICACIÓN
// Para usar: renombra este archivo a middleware.ts (respalda el original primero)

import { NextResponse } from 'next/server';

export default function middleware() {
  // Preview mode - sin autenticación
  return NextResponse.next();
}

export const config = {
  matcher: [],
};

