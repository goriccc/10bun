'use client';

import { useEffect, useState } from 'react';
import { GameFrame } from '@/components/games/GameFrame';
import { ShareSheet } from '@/components/ShareSheet';
import { Tickets, usePlay, type Finish } from '@/components/usePlay';
import { serviceById } from '@/content/services';
import { kstDateKey } from '@/lib/daily';
import { markDone } from '@/lib/done';
import { colorPoint, colorTotal, hsbCss, todayColors, type Hsb } from '@/lib/games/color';
import { dateShort, rankLine } from '@/lib/share';

const service = serviceById(2)!;

export function ColorGame() {
  const play = usePlay(2);
  const [colors, setColors] = useState<Hsb[] | null>(null);
  const [step, setStep] = useState(-1);
  const [count, setCount] = useState(3);
  const [pick, setPick] = useState<Hsb>([180, 50, 60]);
  const [picks, setPicks] = useState<Hsb[]>([]);
  const [points, setPoints] = useState<number[]>([]);
  const [result, setResult] = useState<Finish | null>(null);
  const [share, setShare] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setColors(todayColors(kstDateKey())), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (step < 0 || !colors || count <= 0) return;
    const timer = window.setTimeout(() => setCount((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [colors, count, step]);

  const start = () => {
    play.begin();
    setPicks([]);
    setPoints([]);
    setResult(null);
    setStep(0);
    setCount(3);
  };

  const savePick = () => {
    if (!colors) return;
    const score = colorPoint(colors[step], pick);
    const nextPicks = [...picks, pick];
    const nextPoints = [...points, score];
    setPicks(nextPicks);
    setPoints(nextPoints);
    if (step < 4) {
      setStep(step + 1);
      setCount(3);
      setPick([180, 50, 60]);
      return;
    }
    const total = colorTotal(colors, nextPicks);
    void play.finish(total, { picks: nextPicks }).then((done) => {
      setResult(done);
      setStep(5);
      markDone(2);
    });
  };

  const showing = colors && step >= 0 && step < 5 && count > 0;
  const choosing = colors && step >= 0 && step < 5 && count <= 0 && !result;
  const shareText = result
    ? `오늘의 색 ${dateShort()}\n${result.score.toFixed(2)} / 50점\n${points.map((point) => (point >= 8 ? '🟩' : point >= 5 ? '🟨' : '🟥')).join('')}${result.kind === 'ranked' ? `\n${rankLine(result.rank, result.participants)}` : ''}`
    : '';

  return (
    <GameFrame service={service} notice={play.notice} rolled={play.rolled} playing={step >= 0 && step < 5} revision={play.revision} profile={play.profile} needEdit={play.needEdit} onSave={play.save}>
      <div className="g-center">
        <Tickets left={play.attemptsLeft} total={play.tries} />
        {step < 0 ? (
          <>
            <h2 className="plain">색 5개, 하나씩 3초</h2>
            <p className="hint">사라진 색을 슬라이더로 다시 만들어요.</p>
            <button className="btn xl red" type="button" onClick={start} disabled={!colors}>
              시작
            </button>
            <p className="hint">공식 도전은 하루 한 번이에요</p>
          </>
        ) : null}
        {showing && colors ? (
          <>
            <span className="lbl">{step + 1} / 5번째 색을 기억하세요</span>
            <div className="swatch" style={{ background: hsbCss(...colors[step]) }}>
              <b>{count}</b>
            </div>
          </>
        ) : null}
        {choosing ? (
          <>
            <span className="lbl">{step + 1} / 5번째 색을 다시 만드세요</span>
            <div className="swatch" style={{ background: hsbCss(...pick) }} />
            <label className="field">
              색상
              <input type="range" min={0} max={360} value={pick[0]} onChange={(event) => setPick([Number(event.target.value), pick[1], pick[2]])} />
            </label>
            <label className="field">
              진하기
              <input type="range" min={0} max={100} value={pick[1]} onChange={(event) => setPick([pick[0], Number(event.target.value), pick[2]])} />
            </label>
            <label className="field">
              밝기
              <input type="range" min={0} max={100} value={pick[2]} onChange={(event) => setPick([pick[0], pick[1], Number(event.target.value)])} />
            </label>
            <button className="btn red" type="button" onClick={savePick}>
              이 색으로
            </button>
          </>
        ) : null}
        {result && colors ? (
          <div className="panel" role="status">
            <b>
              {result.score.toFixed(2)} / 50점
            </b>
            <p className="rankline">{result.kind === 'ranked' ? rankLine(result.rank, result.participants) : result.message}</p>
            <div className="color-grid">
              {colors.map((color, index) => (
                <div key={index}>
                  <i style={{ background: hsbCss(...color) }} />
                  <i style={{ background: hsbCss(...(picks[index] ?? color)) }} />
                  <small>{(points[index] ?? 0).toFixed(1)}</small>
                </div>
              ))}
            </div>
            <p className="hint">위가 정답, 아래가 내가 만든 색이에요.</p>
            <div className="form-actions">
              <button className="btn sm ghost" type="button" onClick={() => setShare(true)}>
                결과 공유
              </button>
            </div>
          </div>
        ) : null}
      </div>
      {share && result ? <ShareSheet slug={service.slug} title={`${result.score.toFixed(2)} / 50점`} text={shareText} onClose={() => setShare(false)} /> : null}
    </GameFrame>
  );
}
