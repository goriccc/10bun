'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Aquarium } from '@/components/games/Aquarium';
import { fishKind } from '@/components/games/fish-species';
import { GameFrame } from '@/components/games/GameFrame';
import { AdSlot } from '@/components/AdSlot';
import { ShareSheet } from '@/components/ShareSheet';
import { useDeviceProfile } from '@/components/useDeviceProfile';
import { regions } from '@/content/regions';
import { serviceById } from '@/content/services';
import { loadDeviceId } from '@/lib/device';
import { decayFishFullness, formatFishFullness } from '@/lib/fish-fullness';
import { phaseMessage } from '@/lib/phase3-message';

const service = serviceById(14);
const SNAP_KEY = '10bun:fish:snap';

type Fish = { generation?: number; fullness?: number; born_at?: string; died_at?: string | null; alive?: boolean; reason?: string | null; region?: string | null; feeders?: number };
type Past = { generation?: number; born_at?: string; died_at?: string; reason?: string; region?: string | null; feeders?: number };
type Recent = { region?: string; at?: string };
type Board = { ok?: boolean; code?: string; fish?: Fish; left?: number; recent?: Recent[]; past?: Past[]; synced_at?: number };

function readSnap(): Board | null {
  try {
    const raw = sessionStorage.getItem(SNAP_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Board;
    return data?.ok && data.fish?.generation != null ? data : null;
  } catch {
    return null;
  }
}

function writeSnap(data: Board, syncedAt = Date.now()) {
  if (!data.ok || data.fish?.generation == null) return;
  try {
    sessionStorage.setItem(
      SNAP_KEY,
      JSON.stringify({
        ok: true,
        fish: data.fish,
        recent: data.recent ?? [],
        past: data.past ?? [],
        left: data.left,
        synced_at: syncedAt,
      }),
    );
  } catch {
    /* ignore quota */
  }
}

function ageText(from?: string, to = Date.now()): string {
  if (!from) return '';
  const sec = Math.max(0, Math.floor((to - Date.parse(from)) / 1000));
  const min = Math.floor(sec / 60);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);
  if (day > 0) return `${day}일 ${hour % 24}시간 ${min % 60}분`;
  if (hour > 0) return `${hour}시간 ${min % 60}분 ${sec % 60}초`;
  return `${min}분 ${sec % 60}초`;
}

function clock(at?: string): string {
  if (!at) return '';
  return new Date(at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Seoul' });
}

export function FishGame({ initial }: { initial?: Board | null }) {
  const { profile, needEdit, setNeedEdit, save } = useDeviceProfile();
  const [board, setBoard] = useState<Board | null>(initial?.ok ? initial : null);
  const [notice, setNotice] = useState('');
  const [region, setRegion] = useState('서울');
  const [pending, setPending] = useState(false);
  const [feedKey, setFeedKey] = useState(0);
  const [cool, setCool] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [share, setShare] = useState('');
  const [pastOpen, setPastOpen] = useState(false);
  const [pastPage, setPastPage] = useState(0);
  const [syncedAt, setSyncedAt] = useState(() => Date.now());
  const loadGen = useRef(0);
  const starvedRef = useRef(false);

  const applyBoard = (data: Board, at = Date.now()) => {
    setBoard(data);
    setSyncedAt(data.synced_at ?? at);
    starvedRef.current = false;
    if (data.ok) writeSnap(data, data.synced_at ?? at);
  };

  const load = () => {
    const gen = ++loadGen.current;
    const device = loadDeviceId();
    void fetch('/api/bun/fish', { cache: 'no-store', headers: device ? { 'x-bun-device': device } : {} })
      .then((res) => res.json())
      .then((data: Board) => {
        if (gen === loadGen.current) applyBoard(data);
      })
      .catch(() => {
        if (gen === loadGen.current) setNotice(phaseMessage('bad_request'));
      });
  };

  useLayoutEffect(() => {
    if (initial?.ok) {
      const at = Date.now();
      writeSnap(initial, at);
      setSyncedAt(at);
      return;
    }
    setBoard((prev) => {
      if (prev?.ok) return prev;
      const snap = readSnap();
      if (snap?.synced_at) setSyncedAt(snap.synced_at);
      return snap;
    });
  }, [initial]);

  useEffect(() => {
    // SSR/스냅이 있으면 첫 왕복을 건너뛰고 폴링만 한다.
    if (!initial?.ok) load();
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      load();
    }, 8000);
    return () => window.clearInterval(poll);
  }, [initial?.ok]);

  useEffect(() => {
    const fish = board?.ok ? board.fish : undefined;
    if (!fish || fish.alive === false) return;
    const live = decayFishFullness(Number(fish.fullness ?? 0), syncedAt, now);
    if (live > 0 || starvedRef.current) return;
    starvedRef.current = true;
    load();
  }, [board, syncedAt, now]);

  useEffect(() => {
    if (profile && (regions as readonly string[]).includes(profile.region)) setRegion(profile.region);
  }, [profile]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (cool <= 0) return;
    const timer = window.setTimeout(() => setCool((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cool]);

  const feed = async () => {
    const device = loadDeviceId();
    const saved = profile;
    if (!device || !saved) {
      setNotice('이 브라우저에는 참여자 이름을 저장할 수 없어요.');
      return;
    }
    if (board?.ok && Number(board.left) <= 0) {
      setNotice(phaseMessage('no_attempts'));
      return;
    }
    setPending(true);
    try {
      const res = await fetch('/api/bun/fish/feed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ device, nickname: saved.nickname, region }),
      });
      const data = (await res.json()) as { ok?: boolean; code?: string; fullness?: number | string; left?: number | string; dead?: boolean; reason?: string };
      if (data.ok) {
        const fullness = Number(data.fullness);
        const left = Number(data.left);
        loadGen.current += 1;
        const at = Date.now();
        setSyncedAt(at);
        starvedRef.current = false;
        setBoard((prev) => {
          if (!prev?.fish) return prev;
          const next = {
            ...prev,
            left: Number.isFinite(left) ? left : prev.left,
            fish: {
              ...prev.fish,
              fullness: Number.isFinite(fullness) ? fullness : Number(prev.fish.fullness ?? 0) + 16,
              alive: !data.dead,
              reason: data.dead ? (data.reason ?? '과식') : prev.fish.reason,
              region,
            },
            synced_at: at,
          };
          writeSnap(next, at);
          return next;
        });
        setCool(60);
        setFeedKey((key) => key + 1);
        setNotice(data.dead ? '배가 너무 불러 물고기가 떠났어요.' : `${region}에서 먹이 한 알을 줬어요.`);
      } else {
        if (data.code === 'no_attempts') setBoard((prev) => (prev ? { ...prev, left: 0 } : prev));
        setNotice(phaseMessage(data.code ?? 'bad_request'));
        if (data.code === 'bad_nickname' || data.code === 'bad_region') setNeedEdit(true);
      }
      load();
    } catch {
      setNotice(phaseMessage('bad_request'));
    } finally {
      setPending(false);
    }
  };

  const hatch = async () => {
    setPending(true);
    try {
      const res = await fetch('/api/bun/fish/hatch', { method: 'POST' });
      const data = (await res.json()) as { ok?: boolean; code?: string };
      setNotice(data.ok ? '새 물고기가 태어났어요.' : phaseMessage(data.code ?? 'bad_request'));
      load();
    } catch {
      setNotice(phaseMessage('bad_request'));
    } finally {
      setPending(false);
    }
  };

  if (!service) return null;
  const fish = board?.ok ? board.fish : undefined;
  const storedFull = Number(fish?.fullness ?? 0);
  const liveFull =
    fish && fish.alive !== false ? decayFishFullness(storedFull, syncedAt, now) : Math.max(0, storedFull);
  const full = Math.max(0, Math.min(110, liveFull));
  const aliveNow = Boolean(fish) && fish?.alive !== false && full > 0;
  const tone = full <= 0 ? '떠났어요' : full < 15 ? '굶주림, 위험' : full < 30 ? '배고파요' : full <= 80 ? '딱 좋아요' : '과식 위험';
  const toneColor = full <= 0 || full < 15 ? 'var(--red-d)' : full < 30 ? 'var(--yellow-d)' : full <= 80 ? 'var(--mint-d)' : 'var(--orange-d)';
  const lived = fish ? ageText(fish.born_at, !aliveNow && fish.died_at ? Date.parse(fish.died_at) : now) : '';
  const recent = board?.ok ? (board.recent ?? []) : [];
  const noFeeds = board?.ok === true && Number(board.left) <= 0;
  const showMemorial = Boolean(fish) && !aliveNow;

  return (
    <>
      <GameFrame service={service} notice={notice} revision={0} profile={profile} needEdit={needEdit} onSave={save}>
        <div className="room-stack">
          <div className="tank" aria-label="어항">
            <Aquarium swimming={aliveNow} generation={fish?.generation} known={fish?.generation != null} mood={full > 85 ? 'stuffed' : full < 15 ? 'hungry' : 'ok'} feedKey={feedKey} />
            <div className="tank-name">
              {fish ? `두부 ${fish.generation}세` : '어항'}
              <small>
                {fish ? `${fishKind(fish.generation).name} · ` : ''}
                {showMemorial ? '떠났어요' : fish ? `${lived}째 생존 중` : board?.ok ? '물고기가 없어요' : '상태를 아직 불러오지 못했어요'}
              </small>
            </div>
            {showMemorial && fish ? (
              <div className="memorial">
                <div className="card">
                  <div className="hint">추모 카드 · {fishKind(fish.generation).name}</div>
                  <div className="memorial-name">두부 {fish.generation}세</div>
                  <b>{lived} 동안 살았어요</b>
                  <div className="memorial-grid">
                    <div className="panel">
                      <small className="hint">떠난 이유</small>
                      <div>{fish.reason === '과식' ? '과식' : '굶주림'}</div>
                    </div>
                    <div className="panel">
                      <small className="hint">마지막 먹이</small>
                      <div>{fish.region || '없음'}</div>
                    </div>
                    <div className="panel wide">
                      <small className="hint">함께 키운 사람</small>
                      <div>{Number(fish.feeders ?? 0).toLocaleString('ko-KR')}명</div>
                    </div>
                  </div>
                  <div className="row c">
                    <button
                      className="btn ghost sm"
                      type="button"
                      onClick={() =>
                        setShare(`모두의 어항\n두부 ${fish.generation}세가 ${lived} 살고 떠났어요\n사인: ${fish.reason === '과식' ? '과식' : '굶주림'}. 마지막 먹이는 ${fish.region || '없음'}\n다음 물고기는 우리가 지켜요`)
                      }
                    >
                      추모 카드 공유
                    </button>
                    <button className="btn violet sm" type="button" disabled={pending} onClick={() => void hatch()}>
                      새 알 부화
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <div className="fish-board">
            <div className="fish-controls">
              <div className="row">
                <b>포만감 {fish ? formatFishFullness(full) : '—'}</b>
                <span style={{ color: toneColor, fontWeight: 700 }}>{fish && aliveNow ? tone : ''}</span>
              </div>
              <div className="fish-gauge">
                <div className="gauge" aria-hidden="true">
                  <i style={{ width: '15%', background: 'var(--red)' }} />
                  <i style={{ width: '15%', background: 'var(--yellow)' }} />
                  <i style={{ width: '50%', background: 'var(--mint)' }} />
                  <i style={{ width: '20%', background: 'var(--orange)' }} />
                </div>
                <div className="gauge-mk" style={{ left: `calc(${Math.min(full, 100)}% - 2px)` }} />
              </div>
              <div className="fish-scale">
                <span>0 굶어 죽음</span>
                <span>적당 30~80</span>
                <span>100 넘으면 과식사</span>
              </div>
              <div className="form-stack">
                <label className="field">
                  먹이를 주는 시도
                  <select value={region} onChange={(event) => setRegion(event.target.value)}>
                    {regions.map((name) => (
                      <option key={name}>{name}</option>
                    ))}
                  </select>
                </label>
                <div className="fish-feed">
                  <button className="btn violet" type="button" disabled={pending || cool > 0 || noFeeds || !aliveNow} onClick={() => void feed()}>
                    {noFeeds ? '오늘 먹이를 다 줬어요' : cool > 0 ? `먹이 주기 (${cool}초)` : '먹이 주기'}
                  </button>
                  <div className="fish-left">
                    <b>{board?.ok && board.left != null ? Number(board.left) : '—'}</b>
                    <small className="hint">오늘 남은 먹이</small>
                  </div>
                </div>
              </div>
              <p className="hint">먹이 한 알에 포만감 +16. 다른 사람이 방금 줬을 수 있으니 게이지를 보고 주세요. 낮에는 약 12분, 밤에는 약 36분이면 포만감이 바닥나요.</p>
            </div>
            <div className="panel fish-log">
              <b>방금 먹이 준 곳</b>
              {recent.length === 0 && board?.ok ? <p className="hint">아직 먹이를 준 곳이 없어요.</p> : null}
              <div className="flog">
                {recent.map((item) => (
                  <div key={`${item.region}-${item.at}`}>
                    <span>{item.region}에서 먹이 1알</span>
                    <span>{clock(item.at)}</span>
                  </div>
                ))}
              </div>
              {fish ? (
                <p className="hint">
                  함께 키운 사람 <b>{Number(fish.feeders ?? 0).toLocaleString('ko-KR')}</b>명
                </p>
              ) : null}
            </div>
          </div>
          <div className="panel">
            <b>역대 물고기</b>
            {(() => {
              const pastAll = board?.ok ? board.past ?? [] : [];
              if (board?.ok && pastAll.length === 0) return <p className="hint">아직 떠난 물고기가 없어요.</p>;
              const pageSize = pastOpen ? 5 : 2;
              const pages = Math.max(1, Math.ceil(pastAll.length / pageSize));
              const page = Math.min(pastPage, pages - 1);
              const rows = pastAll.slice(page * pageSize, page * pageSize + pageSize);
              return (
                <>
                  <table className="room-table">
                    <thead>
                      <tr>
                        <th>이름</th>
                        <th>살았던 시간</th>
                        <th>떠난 이유</th>
                        <th>마지막 먹이</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((item) => (
                        <tr key={item.generation}>
                          <td>두부 {item.generation}세</td>
                          <td>{ageText(item.born_at, item.died_at ? Date.parse(item.died_at) : now)}</td>
                          <td>{item.reason}</td>
                          <td>{item.region || '없음'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="form-actions fish-past-nav">
                    {!pastOpen && pastAll.length > 2 ? (
                      <button
                        className="btn sm ghost"
                        type="button"
                        onClick={() => {
                          setPastOpen(true);
                          setPastPage(0);
                        }}
                      >
                        더 보기 ({pastAll.length}마리)
                      </button>
                    ) : null}
                    {pastOpen ? (
                      <>
                        <button className="btn sm ghost" type="button" disabled={page <= 0} onClick={() => setPastPage((n) => Math.max(0, n - 1))}>
                          이전
                        </button>
                        <span className="hint">
                          {page + 1} / {pages}
                        </span>
                        <button className="btn sm ghost" type="button" disabled={page >= pages - 1} onClick={() => setPastPage((n) => Math.min(pages - 1, n + 1))}>
                          다음
                        </button>
                        <button
                          className="btn sm ghost"
                          type="button"
                          onClick={() => {
                            setPastOpen(false);
                            setPastPage(0);
                          }}
                        >
                          접기
                        </button>
                      </>
                    ) : null}
                  </div>
                </>
              );
            })()}
            <AdSlot />
          </div>
        </div>
      </GameFrame>
      {share ? <ShareSheet slug="fishbowl" title={fish ? `두부 ${fish.generation}세를 기억하며` : '모두의 어항'} text={share} onClose={() => setShare('')} /> : null}
    </>
  );
}
