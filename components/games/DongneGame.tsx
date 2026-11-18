'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { GameFrame } from '@/components/games/GameFrame';
import { ShareSheet } from '@/components/ShareSheet';
import { Tickets, usePlay, type Finish } from '@/components/usePlay';
import { DONGNE_CREDIT, dongneByCode, dongnePlaces, type DongnePlace } from '@/content/dongne';
import { serviceById } from '@/content/services';
import { markDone } from '@/lib/done';
import { arrowOf, bearingDeg, closeness, dongneScore, haversineKm, shareRow } from '@/lib/games/dongne';
import { dateShort, rankLine } from '@/lib/share';

type DongneDay = {
  code: string;
  path: string;
  easyCode: string;
  easyPath: string;
  sidos: { code: string; label: string; lat: number; lng: number }[];
};

const service = serviceById(5)!;
const TRIES = 6;

type Guess = { label: string; km: number; bearing: number };
type Spot = { label: string; lat: number; lng: number };

function measure(guess: Spot, answer: Spot): Guess {
  const raw = haversineKm([guess.lat, guess.lng], [answer.lat, answer.lng]);
  const same = guess.label === answer.label;
  return { label: guess.label, km: same ? 0 : Math.max(1, Math.round(raw)), bearing: bearingDeg([guess.lat, guess.lng], [answer.lat, answer.lng]) };
}

export function DongneGame({ day }: { day: DongneDay }) {
  const play = usePlay(5);
  const answer = dongneByCode(day.code);
  const easy = day.sidos.find((item) => item.code === day.easyCode);
  const [mode, setMode] = useState<'sgg' | 'sido'>('sgg');
  const [query, setQuery] = useState('');
  const [sgg, setSgg] = useState<Guess[]>([]);
  const [sido, setSido] = useState<Guess[]>([]);
  const [result, setResult] = useState<Finish | null>(null);
  const [easyDone, setEasyDone] = useState(false);
  const [share, setShare] = useState(false);
  const [toast, setToast] = useState('');
  const began = useRef(false);
  const started = useRef(0);

  useEffect(() => {
    started.current = Date.now();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 1600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const official = mode === 'sgg';
  const places: Spot[] = official ? dongnePlaces : day.sidos;
  const target: Spot | undefined = official ? answer : easy;
  const guesses = official ? sgg : sido;
  const finished = official ? Boolean(result) : easyDone;
  const path = official ? day.path : day.easyPath;
  const won = guesses.some((guess) => guess.km === 0);
  const open = !finished && guesses.length < TRIES && !won;

  const matches = (() => {
    const text = query.replace(/\s+/g, '');
    if (!text || !open) return [];
    return places.filter((place) => place.label.replace(/\s+/g, '').includes(text) || ('name' in place && String((place as DongnePlace).name).replace(/\s+/g, '').includes(text))).slice(0, 12);
  })();

  const submitLabel = (label: string) => {
    if (!target || !open) return;
    const place = places.find((item) => item.label === label);
    if (!place) {
      setToast(official ? '목록에 있는 시군구 이름을 골라 주세요' : '목록에 있는 시·도 이름을 골라 주세요');
      return;
    }
    if (guesses.some((guess) => guess.label === label)) {
      setToast('이미 넣은 동네예요');
      return;
    }
    if (official && !began.current) {
      began.current = true;
      play.begin();
    }
    const next = [...guesses, measure(place, target)];
    const hit = next[next.length - 1].km === 0;
    if (official) setSgg(next);
    else setSido(next);
    setQuery('');
    if (!hit && next.length < TRIES) return;
    if (!official) {
      setEasyDone(true);
      return;
    }
    const seconds = Math.min(999, Math.max(0, Math.round((Date.now() - started.current) / 1000)));
    const score = dongneScore(hit, next.length, seconds);
    void play.finish(score, { guesses: next.map((guess) => guess.label), seconds }).then((finish) => {
      setResult(finish);
      markDone(5);
    });
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    submitLabel(query.trim());
  };

  const headline = won ? `${guesses.length}번 만에 찾았어요` : `정답은 ${target?.label ?? ''}`;
  const shareText = finished
    ? `오늘의 동네 ${dateShort()} ${won ? guesses.length : 'X'}/6\n${guesses.map((guess) => shareRow(guess.km, guess.bearing)).join('\n')}${official && result?.kind === 'ranked' ? `\n${rankLine(result.rank, result.participants)}` : ''}`
    : '';

  return (
    <GameFrame service={service} notice={play.notice} rolled={play.rolled} playing={!finished} revision={play.revision} profile={play.profile} needEdit={play.needEdit} onSave={play.save}>
      <div className="g-center">
        <Tickets left={play.attemptsLeft} total={play.tries} />
        <div className="dongne-mode" role="group" aria-label="난이도">
          <button className={official ? 'btn blue sm' : 'btn ghost sm'} type="button" aria-pressed={official} onClick={() => setMode('sgg')}>
            시·군·구
          </button>
          <button className={!official ? 'btn blue sm' : 'btn ghost sm'} type="button" aria-pressed={!official} onClick={() => setMode('sido')}>
            시·도
          </button>
        </div>
        <svg className="dongne-svg" viewBox="0 0 200 200" role="img" aria-label={official ? '오늘의 시군구 실루엣' : '오늘의 시도 실루엣'}>
          <path d={path} fill="var(--ink)" fillRule="evenodd" />
        </svg>
        {open ? (
          <form className="dongne-form" onSubmit={onSubmit}>
            <input
              className="inp"
              value={query}
              placeholder={official ? '시군구 이름 입력 (예: 강원 춘천시)' : '시·도 이름 입력 (예: 강원)'}
              autoComplete="off"
              aria-label={official ? '시군구 이름' : '시도 이름'}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button className="btn blue sm" type="button" onClick={() => submitLabel(query.trim())}>
              확인
            </button>
          </form>
        ) : null}
        {open && matches.length > 0 ? (
          <div className="dongne-suggest">
            {matches.map((place) => (
              <button key={place.label} className="btn ghost sm" type="button" onClick={() => submitLabel(place.label)}>
                {place.label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="dongne-list">
          {guesses.map((guess) => (
            <div key={guess.label} className={guess.km === 0 ? 'dongne-row hit' : 'dongne-row'}>
              <b>{guess.label}</b>
              <span>{guess.km === 0 ? '정답!' : `${guess.km.toLocaleString('ko-KR')}km`}</span>
              <span className="dongne-arrow">{guess.km === 0 ? '✓' : arrowOf(guess.bearing)}</span>
              <span className="dongne-pct">{closeness(guess.km)}%</span>
            </div>
          ))}
        </div>
        <p className="hint">{open ? (guesses.length === 0 ? '기회 6번. 틀리면 정답 쪽 방향과 거리를 알려 줘요.' : `남은 기회 ${TRIES - guesses.length}번`) : ''}</p>
        {finished && target ? (
          <div className="panel dongne-result" role="status">
            <b>{headline}</b>
            {official && result ? <p className="hint">{result.kind === 'ranked' ? rankLine(result.rank, result.participants) : result.message}</p> : null}
            {!official ? <p className="hint">시·도 모드는 연습이에요.</p> : null}
            <p className="hint">{DONGNE_CREDIT}</p>
            <div className="form-actions">
              <button className="btn sm" type="button" onClick={() => setShare(true)}>
                결과 공유
              </button>
            </div>
          </div>
        ) : null}
      </div>
      {toast ? (
        <div className="toast show" role="status">
          {toast}
        </div>
      ) : null}
      {share && finished ? <ShareSheet slug="dongne" title={won ? `${guesses.length}/6 정답` : '오늘은 실패'} text={shareText} onClose={() => setShare(false)} /> : null}
    </GameFrame>
  );
}
