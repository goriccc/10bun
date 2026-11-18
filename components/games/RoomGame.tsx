'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { GameFrame } from '@/components/games/GameFrame';
import { serviceById } from '@/content/services';
import { loadDeviceId, loadProfile, saveProfile, type DeviceProfile } from '@/lib/device';
import { errorText } from '@/lib/errors';
import { formatScore } from '@/lib/format';
import { daysLeft, roomCodeOk, roomGameIds, roomInvite, roomLink } from '@/lib/rooms';

const service = serviceById(18);

type Row = {
  rank: number;
  nickname: string;
  today_score: number | string | null;
  played_today: boolean;
  wins: number;
  joined_at: string;
};

type RoomInfo = { code: string; name: string; game_id: number; expires_at: string };

type RoomBody = {
  ok?: boolean;
  code?: string;
  enabled?: boolean;
  joined_at?: string;
  room?: RoomInfo;
  rows?: Row[];
};

function roomMessage(code: string): string {
  switch (code) {
    case 'disabled':
      return '대결방을 잠시 쉬고 있어요.';
    case 'bad_name':
      return '방 이름은 1~20자 한글, 영문, 숫자로 정해 주세요.';
    case 'bad_game':
      return '1번부터 6번 게임 중에서 골라 주세요.';
    case 'not_found':
      return '방을 찾지 못했어요. 기간이 끝났거나 링크가 다를 수 있어요.';
    case 'full':
      return '이 방은 인원이 다 찼어요.';
    case 'blocked':
      return '이 기기는 대결방에 들어갈 수 없어요.';
    case 'retry':
      return '방을 만들지 못했어요. 다시 눌러 주세요.';
    case 'bad_request':
      return '방을 열지 못했어요. 잠시 뒤에 다시 해 주세요.';
    default:
      return errorText(code);
  }
}

function sameInstant(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const left = Date.parse(a);
  const right = Date.parse(b);
  return Number.isFinite(left) && left === right;
}

function scoreText(gameId: number, row: Row): string {
  if (!row.played_today || row.today_score == null) return '미참여';
  const score = Number(row.today_score);
  if (!Number.isFinite(score)) return '미참여';
  return formatScore(gameId, score);
}

export function RoomGame({ code }: { code?: string }) {
  const router = useRouter();
  const [profile, setProfile] = useState<DeviceProfile | null>(null);
  const [needEdit, setNeedEdit] = useState(false);
  const [name, setName] = useState('');
  const [gameId, setGameId] = useState<number>(1);
  const [notice, setNotice] = useState('');
  const [toast, setToast] = useState('');
  const [pending, setPending] = useState(false);
  const [phase, setPhase] = useState<'form' | 'loading' | 'room' | 'missing'>(code ? 'loading' : 'form');
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [mine, setMine] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => setProfile(loadProfile()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 1600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const roomCode = (code ?? '').trim().toUpperCase();
    if (!roomCode) return;
    if (!roomCodeOk(roomCode)) {
      setNotice(roomMessage('not_found'));
      setPhase('missing');
      return;
    }
    const device = loadDeviceId();
    const saved = loadProfile();
    if (!device || !saved) {
      setNotice('이 브라우저에는 참여자 이름을 저장할 수 없어요.');
      setPhase('missing');
      return;
    }
    let stop = false;
    let opened = false;

    const applyBoard = (view: RoomBody) => {
      if (!view.ok || !view.room) {
        if (opened) return;
        setNotice(roomMessage(view.code ?? 'not_found'));
        setPhase('missing');
        return;
      }
      opened = true;
      setRoom({ ...view.room, game_id: Number(view.room.game_id) });
      setRows(Array.isArray(view.rows) ? view.rows : []);
      if (view.enabled === false) setNotice(roomMessage('disabled'));
      setPhase('room');
    };

    const load = async (join: boolean) => {
      if (join) {
        const res = await fetch('/api/bun/room/join', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ device, nickname: saved.nickname, region: saved.region, code: roomCode }),
        });
        const data = (await res.json()) as RoomBody;
        if (stop) return;
        if (data.ok && data.joined_at) {
          setMine(data.joined_at);
          setNotice('');
        }
        if (!data.ok && data.code) {
          setNotice(roomMessage(data.code));
          if (data.code === 'bad_nickname' || data.code === 'bad_region') setNeedEdit(true);
          if (data.code === 'not_found') {
            setPhase('missing');
            return;
          }
        }
      }
      const board = await fetch(`/api/bun/room/${roomCode}`);
      const view = (await board.json()) as RoomBody;
      if (!stop) applyBoard(view);
    };

    void load(true).catch(() => {
      if (!stop && !opened) {
        setNotice(roomMessage('bad_request'));
        setPhase('missing');
      }
    });
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden' || !opened) return;
      void load(false).catch(() => undefined);
    }, 10_000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [code, tick]);

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
        setTick((value) => value + 1);
      }
      return data;
    } catch {
      return { ok: false as const, code: 'network' };
    }
  };

  const createRoom = async () => {
    const device = loadDeviceId();
    const saved = profile ?? loadProfile();
    const trimmed = name.trim();
    if (!device || !saved) {
      setNotice('이 브라우저에는 참여자 이름을 저장할 수 없어요.');
      return;
    }
    if (!/^[\uac00-\ud7a3a-zA-Z0-9]+( [\uac00-\ud7a3a-zA-Z0-9]+)*$/.test(trimmed) || [...trimmed].length > 20) {
      setNotice(roomMessage('bad_name'));
      return;
    }
    setPending(true);
    try {
      const res = await fetch('/api/bun/room', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ device, nickname: saved.nickname, region: saved.region, name: trimmed, gameId }),
      });
      const data = (await res.json()) as RoomBody;
      if (!data.ok || typeof data.code !== 'string' || !roomCodeOk(data.code)) {
        setNotice(roomMessage(data.code ?? 'bad_request'));
        if (data.code === 'bad_nickname' || data.code === 'bad_region') setNeedEdit(true);
        return;
      }
      router.push(`/r/${data.code}`);
    } catch {
      setNotice(roomMessage('bad_request'));
    } finally {
      setPending(false);
    }
  };

  const copyLink = async () => {
    if (!room) return;
    const title = serviceById(room.game_id)?.title ?? '게임';
    try {
      await navigator.clipboard.writeText(roomInvite(room.name, title, room.code));
      setToast('초대 링크를 복사했어요');
    } catch {
      setToast('링크를 길게 눌러 복사해 주세요');
    }
  };

  if (!service) return null;
  const playing = room ? serviceById(room.game_id) : undefined;
  const left = room ? daysLeft(room.expires_at) : 0;

  const form = (
    <div className="room-stack form-stack">
      <h2 className="room-title">대결방 만들기</h2>
      <label className="field">
        방 이름
        <input value={name} maxLength={20} placeholder="예: 우리 팀 점심 내기" onChange={(event) => setName(event.target.value)} />
      </label>
      <div>
        <span className="lbl">겨룰 게임</span>
        <div className="room-games">
          {roomGameIds.map((id) => (
            <button key={id} type="button" aria-pressed={id === gameId} onClick={() => setGameId(id)}>
              {serviceById(id)?.title}
            </button>
          ))}
        </div>
      </div>
      <div className="panel">기간은 오늘부터 7일. 매일 같은 문제로 겨루고, 7일 뒤 방과 기록이 자동으로 지워져요.</div>
      <div className="form-actions">
        <button className="btn orange" type="button" disabled={pending} onClick={() => void createRoom()}>
          {pending ? '만드는 중' : '방 만들기'}
        </button>
      </div>
    </div>
  );

  const board = room ? (
    <div className="room-stack">
      <div>
        <span className="lbl">대결방</span>
        <h2 className="room-title">{room.name}</h2>
        <div className="row">
          {playing ? <span className="chip">{playing.title}</span> : null}
          <span className="chip">{left > 0 ? `남은 기간 ${left}일` : '곧 닫혀요'}</span>
          <span className="chip">방 코드 {room.code}</span>
        </div>
      </div>
      <table className="room-table">
        <thead>
          <tr>
            <th>순위</th>
            <th>이름</th>
            <th>오늘 기록</th>
            <th>7일 누적</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4}>아직 참여자가 없어요.</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.joined_at} className={sameInstant(row.joined_at, mine) ? 'me' : undefined}>
                <td>{row.rank}</td>
                <td>{row.nickname}</td>
                <td>{scoreText(room.game_id, row)}</td>
                <td className="num">{Number(row.wins) || 0}승</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div className="row c">
        <button className="btn orange sm" type="button" onClick={() => void copyLink()}>
          초대 링크 복사
        </button>
        {playing ? (
          <Link className="btn sm" href={`/${playing.slug}`}>
            오늘 게임 하기
          </Link>
        ) : null}
      </div>
    </div>
  ) : (
    <p>{phase === 'loading' ? '방을 불러오고 있어요.' : '방 목록으로 돌아갈 수 있어요.'}</p>
  );

  const side = room ? (
    <div className="room-card">
      <div className="hd">
        <b>{room.name}</b>
        <span>{playing ? `${playing.title}로 7일 대결` : '7일 대결'}</span>
      </div>
      <div className="bd">
        <b>10분닷컴 대결방에 초대합니다</b>
        <div className="room-url">{roomLink(room.code)}</div>
      </div>
    </div>
  ) : (
    <div className="panel">
      <b>이런 사람에게 좋아요</b>
      <p className="hint">팀 단톡방, 가족 단톡방, 동창 모임에 보내 보세요. 한 명이 방을 만들면 링크 하나로 모두 같은 문제를 풀어요.</p>
    </div>
  );

  return (
    <>
      <GameFrame service={service} notice={notice} revision={0} profile={profile} needEdit={needEdit} onSave={save} side={side}>
        {phase === 'room' ? board : phase === 'form' ? form : phase === 'loading' ? <p>방을 불러오고 있어요.</p> : (
          <div className="room-stack">
            <p>새 방을 만들 수 있어요.</p>
            <Link className="btn orange" href="/room">
              대결방 만들기
            </Link>
          </div>
        )}
      </GameFrame>
      <div className={`toast${toast ? ' show' : ''}`} role="status">
        {toast}
      </div>
    </>
  );
}
