'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ProfileForm } from '@/components/ProfileForm';
import { errorText } from '@/lib/errors';
import { sharedJson } from '@/lib/client-fetch';
import { formatScore, gapText, kstClock } from '@/lib/format';
import { kstDateKey } from '@/lib/daily';
import { fetchMe } from '@/lib/me-fetch';
import { track } from '@/lib/analytics';
import type { DeviceProfile } from '@/lib/device';

type Row = { rank?: number; nickname?: string; region?: string; score?: number | string; achieved_at?: string; points?: number; days?: number };
type Board = {
  ok?: boolean;
  enabled?: boolean;
  participants?: number;
  top?: Row[];
  cutoffs?: Record<string, number | string>;
  regions?: { region: string; avg: number | string; count: number }[];
  perfect_count?: number | null;
  week?: { from?: string; through?: string; last_week?: boolean; final?: boolean; top?: Row[] };
};
type Me = {
  ok?: boolean;
  enabled?: boolean;
  has_record?: boolean;
  nickname?: string;
  region?: string;
  best?: number | string;
  rank?: number;
  participants?: number;
  pct?: number | null;
  attempts_left?: number;
  week_points?: number;
  above?: Row[];
  below?: Row[];
};

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function isMonday(): boolean {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Seoul', weekday: 'short' }).format(new Date()) === 'Mon';
}

export function RankBoard({
  gameId,
  revision,
  profile,
  onSave,
}: {
  gameId: number;
  revision: number;
  profile: DeviceProfile | null;
  onSave: (next: DeviceProfile) => Promise<{ ok?: boolean; code?: string }>;
}) {
  const [board, setBoard] = useState<Board | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTab] = useState<'top' | 'near' | 'region' | 'week'>('top');
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState('');
  const lastRank = useRef<number | null>(null);

  const load = useCallback(async () => {
    const device = profile ? window.localStorage.getItem('10bun:device') : null;
    const [boardNext, meNext] = await Promise.all([
      sharedJson(`board:${gameId}`, async () => {
        const res = await fetch(`/api/bun/board/${gameId}`);
        return (await res.json()) as Board;
      }),
      device ? fetchMe(gameId, device) : Promise.resolve(null),
    ]);
    setBoard(boardNext);
    if (!meNext || !meNext.httpOk || meNext.body.ok === false) return;
    const next = meNext.body as Me;
    setMe(next);
    if (typeof next.rank === 'number') {
      if (lastRank.current != null && next.rank > lastRank.current) {
        const passed = next.rank - lastRank.current;
        setToast(`${passed}명이 앞질렀어요. ${lastRank.current}위 → ${next.rank}위`);
      }
      lastRank.current = next.rank;
    }
  }, [gameId, profile]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch(() => setBoard({ enabled: false }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load, revision]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load().catch(() => undefined);
    }, 60000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  if (!board) return <section className="lb" aria-busy="true" />;
  if (board.enabled === false) {
    return (
      <section className="lb">
        <p>{errorText('disabled')}</p>
      </section>
    );
  }

  const mine = num(me?.best);
  const rank = me?.has_record ? me.rank ?? null : null;
  const levels = [1, 10, 100, 1000];
  const nextCutoff = rank == null ? null : [...levels].reverse().find((level) => level < rank && board.cutoffs?.[String(level)] != null);
  const cutoffScore = nextCutoff == null ? null : num(board.cutoffs?.[String(nextCutoff)]);
  const rows = tab === 'near' ? [...(me?.above ?? []), ...(me?.has_record ? [{ rank: me.rank, nickname: me.nickname, region: me.region, score: me.best }] : []), ...(me?.below ?? [])] : tab === 'region' ? [] : tab === 'week' ? board.week?.top ?? [] : board.top ?? [];

  const choose = (next: typeof tab) => {
    setTab(next);
    track('board_tab', { game: String(gameId), tab: next });
  };

  const people = Math.max(board.participants ?? 0, rank ?? 0);
  const marks = [1000, 100, 10, 1].filter((level) => level < people);
  const ladderAt = (value: number) => (people < 2 ? 0 : 100 * (1 - Math.log10(Math.max(1, value)) / Math.log10(people)));
  const regionRows = [...(board.regions ?? [])].sort((a, b) => (gameId === 1 || gameId === 6 || gameId === 17 ? Number(a.avg) - Number(b.avg) : Number(b.avg) - Number(a.avg)));
  const regionValues = regionRows.map((item) => Number(item.avg));
  const regionLo = Math.min(...regionValues);
  const regionHi = Math.max(...regionValues);

  return (
    <section className="lb" aria-label="전국 순위">
      <div className="lb-top">
        <div>
          <h2>오늘의 전국 순위</h2>
          <p>
            {gameId === 17 ? '반응속도' : gameId === 6 ? '시간' : gameId === 1 ? '오차' : '점수'} 기준, 매일 0시에 초기화
            {gameId === 1 && (board.perfect_count ?? 0) >= 1 ? `. 오늘 ±0.000초 완벽 기록 ${board.perfect_count}명, 같은 기록은 먼저 낸 순서` : ''}
          </p>
        </div>
        <div className="lb-live">
          참여 <b>{(board.participants ?? 0).toLocaleString('ko-KR')}</b>명
        </div>
      </div>
      {profile ? (
        <div className="lb-who">
          {editing ? (
            <ProfileForm
              profile={profile}
              onSave={async (next) => {
                const result = await onSave(next);
                if (result.ok) setEditing(false);
                return result;
              }}
            />
          ) : (
            <>
              <span>
                순위표에 <b>{profile.nickname}</b>, <b>{profile.region}</b>(으)로 올라가요
              </span>
              <button className="linkbtn" type="button" onClick={() => setEditing(true)}>
                바꾸기
              </button>
            </>
          )}
        </div>
      ) : null}
      <div className="lb-me">
        <div className="lb-rank">
          <small>내 순위</small>
          <b>{rank ?? '?'}</b>
          {rank ? <em>위</em> : null}
        </div>
        <div className="lb-info">
          <div className="lb-best">
            {me?.has_record && rank && mine != null ? (
              <>
                내 최고 <b>{formatScore(gameId, mine)}</b>
                {me.pct != null ? `, 상위 ${me.pct}%` : ''}
              </>
            ) : (
              '기록을 내면 여기에 내 순위가 떠요.'
            )}
          </div>
          <div className="lb-goals">
            {nextCutoff && mine != null && cutoffScore != null ? (
              <span>
                {nextCutoff.toLocaleString('ko-KR')}위 안까지 <b>{gapText(gameId, mine, cutoffScore)}</b>
              </span>
            ) : null}
            {profile?.region === '미정' ? <span>시도를 고르면 시도 대항에 들어가요.</span> : null}
          </div>
        </div>
      </div>
      {people >= 2 ? (
        <div className="lb-ladder" aria-hidden="true">
          <div className="track" />
          {marks.map((level) => (
            <span key={level} className="mk" style={{ left: `${ladderAt(level)}%` }}>
              {level === 1 ? '1위' : `${level.toLocaleString('ko-KR')}위`}
            </span>
          ))}
          <span className="mk" style={{ left: '0%' }}>
            {people.toLocaleString('ko-KR')}위
          </span>
          {rank ? (
            <span className="dot" style={{ left: `${ladderAt(rank)}%` }}>
              나
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="seg-tabs lb-tabs" role="group" aria-label="순위 보기">
        <button type="button" aria-pressed={tab === 'top'} onClick={() => choose('top')}>
          TOP 10
        </button>
        <button type="button" aria-pressed={tab === 'near'} onClick={() => choose('near')}>
          내 주변
        </button>
        {gameId === 17 ? null : (
          <button type="button" aria-pressed={tab === 'region'} onClick={() => choose('region')}>
            시도 대항
          </button>
        )}
        <button type="button" aria-pressed={tab === 'week'} onClick={() => choose('week')}>
          이번 주
        </button>
      </div>
      {tab === 'week' ? <WeekCopy week={board.week} points={me?.week_points ?? 0} /> : null}
      {tab === 'region' ? (
        <ol className="lb-list">
          {regionRows.length === 0 ? <li className="empty">오늘 시도 기록이 아직 없어요.</li> : null}
          {regionRows.map((item, index) => {
            const avg = Number(item.avg);
            const width = 30 + (70 * (gameId === 1 || gameId === 6 || gameId === 17 ? regionHi - avg : avg - regionLo)) / (regionHi - regionLo || 1);
            return (
              <li key={item.region} className={`rgrow${item.region === profile?.region ? ' me' : ''}`}>
                <span className="n">{index + 1}</span>
                <span className="nk">{item.region}</span>
                <span className="bar">
                  <i style={{ width: `${width}%` }} />
                </span>
                <span className="v">{formatScore(gameId, Number.isFinite(avg) ? avg : 0)}</span>
              </li>
            );
          })}
        </ol>
      ) : (
        <ol className="lb-list">
          {rows.length === 0 ? <li className="empty">{tab === 'near' ? '기록을 내면 내 바로 앞뒤 사람들이 보여요.' : '아직 오늘 기록이 없어요.'}</li> : null}
          {rows.slice(0, tab === 'top' ? 10 : 20).map((row, index) => {
            const score = num(row.score);
            const place = row.rank ?? index + 1;
            return (
              <li key={`${row.rank}-${row.nickname}-${index}`} className={`${place <= 3 ? `g${place}` : ''}${row.rank === rank ? ' me' : ''}`}>
                <span className="n">{place.toLocaleString('ko-KR')}</span>
                <span className="nk">
                  {row.nickname}
                  {gameId === 1 && score === 0 && row.achieved_at ? <small className="tt"> {kstClock(row.achieved_at)} 기록</small> : null}
                </span>
                <span className="rg">{row.days != null ? `${row.days}일 참여` : row.region}</span>
                <span className="v">{row.points != null ? `${row.points}점` : score == null ? '' : formatScore(gameId, score)}</span>
              </li>
            );
          })}
        </ol>
      )}
      {toast ? (
        <div className="toast show" role="status">
          {toast}
        </div>
      ) : null}
      <p className="sr">{kstDateKey()}</p>
    </section>
  );
}

function WeekCopy({ week, points }: { week: Board['week']; points: number }) {
  const through = week?.through;
  return (
    <div>
      {week?.last_week && week.final ? <p>지난주 최종 순위</p> : null}
      {week?.last_week && !week.final ? <p>지난주 순위 (집계 중)</p> : null}
      {!week?.last_week && through ? <p>어제({through})까지 반영돼요</p> : null}
      {isMonday() && points === 0 ? <p>이번 주 점수는 내일 0시부터 쌓여요</p> : null}
      <p className="hint">매일 상위 몇 %였는지를 0~100점으로 바꿔 월요일부터 일요일까지 더해요.</p>
      {(week?.top?.length ?? 0) === 0 ? <p className="hint">오늘 기록이 내일 0시에 처음 반영돼요</p> : null}
      <p className="hint">내 주간 점수 {points}점</p>
    </div>
  );
}

export function RegionPanel({ regions }: { regions: { region: string; avg: number | string; count: number }[] }) {
  if (regions.length === 0) return <p className="hint">오늘 시도 기록이 아직 없어요.</p>;
  return (
    <ol className="region-list">
      {regions.map((item, index) => (
        <li key={item.region}>
          <b>{index + 1}</b>
          <span>{item.region}</span>
          <span>
            {Math.round(Number(item.avg))}ms · {item.count}판
          </span>
        </li>
      ))}
    </ol>
  );
}
