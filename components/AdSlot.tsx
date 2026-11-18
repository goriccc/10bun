'use client';

import { useEffect } from 'react';

/** 광고 단위 ID가 없으면 빈 칸을 그리지 않는다. TODO(운영자 확인): 수동 광고 단위 ID */
export function AdSlot({ hidden = false }: { hidden?: boolean }) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const slot = process.env.NEXT_PUBLIC_ADSENSE_SLOT;
  useEffect(() => {
    if (!client || !slot || hidden) return;
    const win = window as Window & { adsbygoogle?: Record<string, unknown>[] };
    win.adsbygoogle = win.adsbygoogle || [];
    try {
      win.adsbygoogle.push({});
    } catch {
      /* 이미 채운 슬롯 */
    }
  }, [client, hidden, slot]);
  if (!client || !slot) return null;
  return (
    <aside className={hidden ? 'ad-slot away' : 'ad-slot'} aria-label="광고">
      <ins className="adsbygoogle" style={{ display: 'block' }} data-ad-client={client} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />
    </aside>
  );
}
