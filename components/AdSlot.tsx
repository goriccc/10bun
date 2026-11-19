'use client';

import { useEffect, useRef, useState } from 'react';
import { AD_MOBILE_MAX, type AdSlotId } from '@/content/ads';

type Device = 'mobile' | 'desktop';

declare global {
  interface Window {
    adsbygoogle?: Record<string, unknown>[];
  }
}

function useAdDevice(): Device | null {
  const [device, setDevice] = useState<Device | null>(null);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${AD_MOBILE_MAX}px)`);
    const apply = () => setDevice(mq.matches ? 'mobile' : 'desktop');
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return device;
}

/**
 * 수동 광고 단위. device가 현재 화면과 다르면 그리지 않는다(숨김 광고 금지).
 * fixed: Google 허용 방식 — auto/full-width 없이 CSS 고정 높이(하단 빈칸·잘림 방지).
 */
export function AdSlot({
  slot,
  device,
  hidden = false,
  className = '',
  format = 'auto',
  fixed = false,
}: {
  slot: AdSlotId | string;
  device: Device;
  hidden?: boolean;
  className?: string;
  format?: 'auto' | 'vertical' | 'horizontal' | 'rectangle';
  /** 모바일 홈 등: 고정 높이 배너. data-ad-format / full-width-responsive 미사용 */
  fixed?: boolean;
}) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const current = useAdDevice();
  const mine = Boolean(client && slot && current === device);
  const pushed = useRef(false);
  const insRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    pushed.current = false;
  }, [slot, device, fixed]);

  useEffect(() => {
    if (!mine || hidden || pushed.current) return;
    const node = insRef.current;
    if (!node) return;
    if (node.getAttribute('data-adsbygoogle-status')) {
      pushed.current = true;
      return;
    }

    let cancelled = false;
    let tries = 0;
    const tick = window.setInterval(() => {
      if (cancelled) return;
      tries += 1;
      // 스크립트가 아직이면 잠깐 기다린다.
      if (typeof window.adsbygoogle === 'undefined' && tries < 40) return;
      window.clearInterval(tick);
      if (cancelled || pushed.current) return;
      if (node.getAttribute('data-adsbygoogle-status')) {
        pushed.current = true;
        return;
      }
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        pushed.current = true;
      } catch {
        /* 이미 채운 슬롯 */
        pushed.current = true;
      }
    }, 50);

    return () => {
      cancelled = true;
      window.clearInterval(tick);
    };
  }, [fixed, hidden, mine, slot]);

  if (!mine) return null;
  const classes = `ad-slot${fixed ? ' ad-fixed' : ''}${hidden ? ' away' : ''}${className ? ` ${className}` : ''}`;
  return (
    <aside className={classes} aria-label="광고">
      {fixed ? (
        <ins ref={insRef} className="adsbygoogle" style={{ display: 'block' }} data-ad-client={client} data-ad-slot={slot} />
      ) : (
        <ins
          ref={insRef}
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client={client}
          data-ad-slot={slot}
          data-ad-format={format}
          data-full-width-responsive="true"
        />
      )}
    </aside>
  );
}
