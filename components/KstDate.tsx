'use client';

import { useEffect, useState } from 'react';
import { kstDateKey } from '@/lib/daily';

const DAYS = '일월화수목금토';

export function KstDate() {
  const [label, setLabel] = useState('');

  useEffect(() => {
    const key = kstDateKey();
    const [year, month, day] = key.split('-').map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    setLabel(`${month}월 ${day}일 ${DAYS[weekday]}요일`);
  }, []);

  return (
    <div className="top-date">
      <strong>{label || '오늘'}</strong>
    </div>
  );
}
