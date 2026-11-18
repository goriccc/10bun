'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { track } from '@/lib/analytics';
import { kstDateKey } from '@/lib/daily';
import { loadDeviceId, loadProfile, saveProfile, type DeviceProfile } from '@/lib/device';
import { errorText } from '@/lib/errors';
import { fetchMe } from '@/lib/me-fetch';
import { serviceById } from '@/content/services';

export type Finish =
  | { kind: 'practice'; message: string; score: number }
  | { kind: 'review'; message: string; score: number; attemptsLeft: number | null }
  | { kind: 'result'; message: string; score: number }
  | {
      kind: 'ranked';
      score: number;
      rank: number;
      prevRank: number | null;
      participants: number;
      pct: number | null;
      best: number;
      improved: boolean;
      attemptsLeft: number | null;
    };

export type StartBody = {
  ok?: boolean;
  code?: string;
  attempt_id?: number | string;
  attempts_left?: number;
  play_date?: string;
  puzzle?: { size: number; image: string | null };
};

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

export function Tickets({ left, total }: { left: number | null; total: number }) {
  if (total <= 0) return null;
  const on = left ?? total;
  return (
    <div className="tks" aria-label={`오늘 공식 도전 ${on}번 남음`}>
      {Array.from({ length: total }, (_, i) => (
        <i key={i} className={i < total - on ? 'tk used' : 'tk'} />
      ))}
      <span>{on}번 남음</span>
    </div>
  );
}

export function usePlay(gameId: number) {
  const service = serviceById(gameId);
  const slug = service?.slug ?? String(gameId);
  const tries = service?.tries ?? 0;
  const [profile, setProfile] = useState<DeviceProfile | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [mode, setMode] = useState<'loading' | 'official' | 'practice'>('loading');
  const [notice, setNotice] = useState('');
  const [needEdit, setNeedEdit] = useState(false);
  const [rolled, setRolled] = useState(false);
  const [revision, setRevision] = useState(0);
  const openedOn = useRef('');
  const startedAt = useRef(0);
  const startRef = useRef<Promise<StartBody> | null>(null);
  const reasonRef = useRef('network');

  useEffect(() => {
    openedOn.current = kstDateKey();
    const timer = window.setInterval(() => {
      if (kstDateKey() !== openedOn.current) setRolled(true);
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const refresh = useCallback(async () => {
    const device = loadDeviceId();
    const saved = loadProfile();
    setProfile(saved);
    if (!device || !saved) {
      setMode('practice');
      setNotice('이 브라우저에는 기록을 남길 수 없어요. 연습으로 할 수 있어요.');
      reasonRef.current = 'storage';
      return;
    }
    try {
      const { httpOk, body: data } = await fetchMe(gameId, device);
      if (!httpOk || data.ok === false) {
        setMode('official');
        setAttemptsLeft(tries);
        return;
      }
      if (typeof data.nickname === 'string' && typeof data.region === 'string') {
        const next = { nickname: data.nickname, region: data.region };
        saveProfile(next);
        setProfile(next);
      }
      const left = typeof data.attempts_left === 'number' ? data.attempts_left : tries;
      setAttemptsLeft(left);
      if (data.enabled === false) {
        setMode('practice');
        setNotice(errorText('disabled'));
        reasonRef.current = 'disabled';
      } else if (data.blocked) {
        setMode('practice');
        setNotice(errorText('blocked'));
        reasonRef.current = 'blocked';
      } else if (left <= 0) {
        setMode('practice');
        setNotice(errorText('no_attempts'));
        reasonRef.current = 'no_attempts';
      } else {
        setMode('official');
        setNotice('');
      }
    } catch {
      setMode('official');
      setAttemptsLeft(tries);
    }
  }, [gameId, tries]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const begin = useCallback((): Promise<StartBody> => {
    startedAt.current = performance.now();
    const device = loadDeviceId();
    const saved = profile ?? loadProfile();
    const deviceDate = kstDateKey();
    if (gameId === 17 && (!saved || saved.region === '미정')) {
      startRef.current = Promise.resolve({ ok: false, code: 'bad_region' });
      setNeedEdit(true);
      setNotice(errorText('bad_region'));
      return startRef.current;
    }
    if (rolled || !device || !saved || mode === 'practice') {
      const code = rolled ? 'expired' : reasonRef.current;
      startRef.current = Promise.resolve({ ok: false, code });
      setMode('practice');
      track('game_start', { game: slug, official: false });
      track('practice_start', { game: slug, reason: code });
      return startRef.current;
    }
    track('game_start', { game: slug, official: true });
    startRef.current = fetch('/api/bun/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ gameId, device, nickname: saved.nickname, region: saved.region }),
    })
      .then((res) => res.json() as Promise<StartBody>)
      .then((data) => {
        if (!data.ok) {
          setMode('practice');
          setNotice(errorText(data.code ?? 'network'));
          reasonRef.current = data.code ?? 'network';
          track('practice_start', { game: slug, reason: data.code ?? 'network' });
          if (data.code === 'bad_nickname' || data.code === 'bad_region') setNeedEdit(true);
          return data;
        }
        if (data.play_date !== deviceDate) {
          setMode('practice');
          setNotice('기기 시간이 맞지 않아 이번 판은 연습으로 기록돼요');
          track('practice_start', { game: slug, reason: 'clock' });
          return { ok: false, code: 'clock' };
        }
        if (typeof data.attempts_left === 'number') setAttemptsLeft(data.attempts_left);
        return data;
      })
      .catch(() => {
        setMode('practice');
        setNotice(errorText('network'));
        track('practice_start', { game: slug, reason: 'network' });
        return { ok: false, code: 'network' };
      });
    return startRef.current;
  }, [gameId, mode, profile, rolled, slug]);

  const finish = useCallback(
    async (score: number, meta: unknown): Promise<Finish> => {
      const elapsed = Math.round(performance.now() - startedAt.current) / 1000;
      const pending = startRef.current;
      const practice = (message: string): Finish => {
        track('game_complete', { game: slug, official: false, score });
        return { kind: 'practice', message, score };
      };
      const startMessage = (code?: string) => {
        if (code === 'clock') return '기기 시간이 맞지 않아 이번 판은 연습으로 기록돼요';
        if (code === 'storage') return '이 브라우저에는 기록을 남길 수 없어요. 연습으로 할 수 있어요.';
        return errorText(code ?? 'network');
      };
      if (!pending) return practice(startMessage('network'));
      const started = await Promise.race([
        pending,
        new Promise<StartBody>((resolve) => {
          window.setTimeout(() => resolve({ ok: false, code: 'network' }), 3000);
        }),
      ]);
      const attemptId = asNumber(started.attempt_id);
      if (!started.ok || attemptId == null) return practice(startMessage(started.code));
      const device = loadDeviceId();
      if (!device) return practice(errorText('network'));
      try {
        const res = await fetch('/api/bun/submit', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ attemptId, device, gameId, score, elapsed, meta }),
        });
        const data = (await res.json()) as StartBody & {
          status?: string;
          rank?: number;
          prev_rank?: number | null;
          participants?: number;
          pct?: number | null;
          best?: number | string;
          improved?: boolean;
          score?: number | string;
        };
        const shown = asNumber(data.score) ?? score;
        if (typeof data.attempts_left === 'number') setAttemptsLeft(data.attempts_left);
        if (!data.ok) {
          track('game_complete', { game: slug, official: false, score: shown });
          return { kind: 'result', message: errorText(data.code ?? 'bad_request'), score: shown };
        }
        track('game_complete', { game: slug, official: true, score: shown });
        setRevision((n) => n + 1);
        if (data.status === 'review') {
          return { kind: 'review', message: errorText('review'), score: shown, attemptsLeft: data.attempts_left ?? null };
        }
        const rank = asNumber(data.rank) ?? 0;
        const participants = asNumber(data.participants) ?? 0;
        track('rank_result', { game: slug, rank, participants, improved: Boolean(data.improved) });
        return {
          kind: 'ranked',
          score: shown,
          rank,
          prevRank: asNumber(data.prev_rank),
          participants,
          pct: asNumber(data.pct),
          best: asNumber(data.best) ?? shown,
          improved: Boolean(data.improved),
          attemptsLeft: typeof data.attempts_left === 'number' ? data.attempts_left : null,
        };
      } catch {
        return practice(errorText('network'));
      }
    },
    [gameId, slug],
  );

  const save = useCallback(
    async (next: DeviceProfile) => {
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
          track('profile_change', { region_changed: next.region !== profile?.region });
          if (mode === 'practice' && reasonRef.current === 'bad_nickname') {
            setMode('official');
            setNotice('');
          }
        }
        return data;
      } catch {
        return { ok: false as const, code: 'network' };
      }
    },
    [mode, profile?.region],
  );

  return { slug, tries, profile, attemptsLeft, mode, notice, needEdit, setNeedEdit, rolled, revision, begin, finish, save, refresh };
}
