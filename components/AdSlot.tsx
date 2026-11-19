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

/** 수동 광고 단위. device가 현재 화면과 다르면 그리지 않는다(숨김 광고 금지). */
export function AdSlot({
  slot,
  device,
  hidden = false,
  className = '',
  format = 'auto',
}: {
  slot: AdSlotId | string;
  device: Device;
  hidden?: boolean;
  className?: string;
  format?: 'auto' | 'vertical' | 'horizontal' | 'rectangle';
}) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const current = useAdDevice();
  const mine = Boolean(client && slot && current === device);
  const pushed = useRef(false);
  const insRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    pushed.current = false;
  }, [slot, device]);

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
  }, [hidden, mine, slot]);

  if (!mine) return null;
  return (
    <aside className={`ad-slot${hidden ? ' away' : ''}${className ? ` ${className}` : ''}`} aria-label="광고">
      <ins
        ref={insRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </aside>
  );
}
