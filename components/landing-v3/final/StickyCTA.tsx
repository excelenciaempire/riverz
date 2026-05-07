'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export function StickyCTA() {
  const [state, setState] = useState<'small' | 'grown' | 'huge'>('small');

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const ratio = doc.scrollTop / Math.max(1, doc.scrollHeight - doc.clientHeight);
      if (ratio >= 0.85) setState('huge');
      else if (ratio >= 0.18) setState('grown');
      else setState('small');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <Link
      href="/sign-up"
      className={`lv2-sticky-cta ${state === 'grown' ? 'is-grown' : ''} ${
        state === 'huge' ? 'is-huge' : ''
      }`}
      aria-label="Únete a la lista de espera"
    >
      Start now
    </Link>
  );
}
