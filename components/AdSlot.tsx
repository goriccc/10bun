'use client';

import { useEffect, useState } from 'react';
import { AD_MOBILE_MAX, type AdSlotId } from '@/content/ads';

type Device = 'mobile' | 'desktop';

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

  useEffect(() => {
    if (!mine || hidden) return;
    const win = window as Window & { adsbygoogle?: Record<string, unknown>[] };
    win.adsbygoogle = win.adsbygoogle || [];
    try {
      win.adsbygoogle.push({});
    } catch {
      /* 이미 채운 슬롯 */
    }
  }, [hidden, mine, slot]);

  if (!mine) return null;
  return (
    <aside className={`ad-slot${hidden ? ' away' : ''}${className ? ` ${className}` : ''}`} aria-label="광고">
      <ins
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
