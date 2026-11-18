'use client';

import { useEffect, useState } from 'react';
import { loadDeviceId, loadProfile, saveProfile, type DeviceProfile } from '@/lib/device';

export function useDeviceProfile() {
  const [profile, setProfile] = useState<DeviceProfile | null>(null);
  const [needEdit, setNeedEdit] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setProfile(loadProfile()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const save = async (next: DeviceProfile) => {
    const device = loadDeviceId();
    if (!device) return { ok: false as const, code: 'network' };
    try {
      const res = await fetch('/api/bun/profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ device, nickname: next.nickname, region: next.region }),
      });
      const data = (await res.json()) as { ok?: boolean; code?: string };
      if (data.ok) {
        saveProfile(next);
        setProfile(next);
        setNeedEdit(false);
      }
      return data;
    } catch {
      return { ok: false as const, code: 'network' };
    }
  };

  return { profile, setProfile, needEdit, setNeedEdit, save };
}
