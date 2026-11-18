'use client';

import { useEffect, useState } from 'react';
import { kstDateKey, shiftDateKey } from '@/lib/daily';

export function VisitStreak() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    try {
      const today = kstDateKey();
      const yesterday = shiftDateKey(today, -1);
      const raw = localStorage.getItem('10bun:streak');
      let next = 1;
      if (raw) {
        const prev = JSON.parse(raw) as { last?: string; count?: number };
        if (prev.last === today && typeof prev.count === 'number') next = prev.count;
        else if (prev.last === yesterday && typeof prev.count === 'number') next = prev.count + 1;
      }
      localStorage.setItem('10bun:streak', JSON.stringify({ last: today, count: next }));
      setCount(next);
    } catch {
      setCount(0);
    }
  }, []);

  if (count < 1) return null;
  return (
    <div className="streak" title="연속 방문">
      <i>{count}</i>
      {count}일째 연속
    </div>
  );
}
