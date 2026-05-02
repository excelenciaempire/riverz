'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

/**
 * Editor view. The dashboard at /landing-lab navigates here with either
 *   ?p=<projectId>      → open an existing project
 *   ?template=<id>      → start a new project from a template
 * The actual editor logic lives in /public/landing-lab.html — we forward
 * the query string so the iframe sees it on first paint.
 */
function EditorFrame() {
  const search = useSearchParams();
  const qs = search.toString();
  const src = qs ? `/landing-lab.html?${qs}` : '/landing-lab.html';
  return (
    <iframe
      src={src}
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', border: 'none', zIndex: 9999 }}
      title="Landing Lab"
      allow="clipboard-write"
    />
  );
}

export default function LandingLabEditPage() {
  return (
    <Suspense fallback={null}>
      <EditorFrame />
    </Suspense>
  );
}
