'use client';

import { useEffect, useState } from 'react';
import { loadDeviceId } from '@/lib/device';

export function DeviceIdNote() {
  const [id, setId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    setId(loadDeviceId());
  }, []);

  if (id === undefined) return null;
  if (!id) return <p>이 브라우저에서는 기기 ID를 저장하지 못해요.</p>;
  return (
    <p>
      이 브라우저의 기기 ID는 <code>{id}</code>이에요. 삭제 요청에 이 번호를 함께 보내 주세요.
    </p>
  );
}
