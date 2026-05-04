'use client';

import { useEffect } from 'react';

/**
 * Single IntersectionObserver wired to two markers:
 *   data-reveal      → adds `in` class (legacy — kept for any old sections still around)
 *   class="lv2-rv"   → adds `on` class (landing-v2 sections; pairs with the .lv2-rv CSS)
 *
 * Both honour an optional `data-rv-delay="<ms>"` to stagger card grids
 * without paying a render cost per item.
 */
export function RevealOnScroll() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('[data-reveal], .lv2-rv');
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => {
        if (el.classList.contains('lv2-rv')) el.classList.add('on');
        else el.classList.add('in');
      });
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const target = entry.target as HTMLElement;
          const delay = parseInt(target.dataset.rvDelay || '0', 10);
          const apply = () => {
            if (target.classList.contains('lv2-rv')) target.classList.add('on');
            else target.classList.add('in');
          };
          if (delay > 0) setTimeout(apply, delay);
          else apply();
          io.unobserve(target);
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}
