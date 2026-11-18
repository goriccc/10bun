'use client';

import { useEffect, useRef, useState } from 'react';
import { GameFrame } from '@/components/games/GameFrame';
import { ShareSheet } from '@/components/ShareSheet';
import { Tickets, usePlay, type Finish } from '@/components/usePlay';
import type { PriceItem } from '@/content/prices';
import { serviceById } from '@/content/services';
import { kstDateKey } from '@/lib/daily';
import { markDone } from '@/lib/done';
import { priceLabel, pricePoint, priceStars, priceTotal, priceWon, todayPrices } from '@/lib/games/price';
import { dateShort, rankLine } from '@/lib/share';

const service = serviceById(4)!;
const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] as const;

type Round = { item: PriceItem; guess: number };

export function PriceGame() {
  const play = usePlay(4);
  const [items, setItems] = useState<PriceItem[] | null>(null);
  const [step, setStep] = useState(0);
  const [digits, setDigits] = useState('');
  const [shown, setShown] = useState<Round | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [result, setResult] = useState<Finish | null>(null);
  const [share, setShare] = useState(false);
  const began = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setItems(todayPrices(kstDateKey())), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const guess = digits ? Number(digits) : 0;
  const item = items?.[step];

  const typeDigit = (key: string) => {
    setDigits((prev) => (prev + key).replace(/^0+/, '').slice(0, 9));
  };

  const decide = () => {
    if (!item || guess <= 0 || shown || result) return;
    if (!began.current) {
      began.current = true;
      play.begin();
    }
    setShown({ item, guess });
  };

  useEffect(() => {
    if (!item || shown || result) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        typeDigit(event.key);
      } else if (event.key === 'Backspace') {
        event.preventDefault();
        setDigits((prev) => prev.slice(0, -1));
      } else if (event.key === 'Enter') {
        decide();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onward = () => {
    if (!shown || !items) return;
    const done = [...rounds, shown];
    setRounds(done);
    setShown(null);
    setDigits('');
    if (done.length < items.length) {
      setStep(done.length);
      return;
    }
    const score = priceTotal(
      done.map((round) => round.guess),
      items.map((entry) => entry.price),
    );
    void play
      .finish(score, { ids: items.map((entry) => entry.id), guesses: done.map((round) => round.guess) })
      .then((finish) => {
        setResult(finish);
        markDone(4);
      });
  };

  const starSum = rounds.reduce((sum, round) => sum + priceStars(round.guess, round.item.price), 0);
  const shareText = result
    ? `그때 그 가격 ${dateShort()}\n${rounds.map((round) => '⭐'.repeat(priceStars(round.guess, round.item.price)) || '☆').join(' ')}\n${starSum} / 15\n정확도 ${result.score.toLocaleString('ko-KR')}점${result.kind === 'ranked' ? `\n${rankLine(result.rank, result.participants)}` : ''}`
    : '';

  return (
    <GameFrame service={service} notice={play.notice} rolled={play.rolled} playing={!result} revision={play.revision} profile={play.profile} needEdit={play.needEdit} onSave={play.save}>
      <div className="g-center">
        <Tickets left={play.attemptsLeft} total={play.tries} />
        {items ? (
          <div className="steps" aria-label={`${step + 1}번째 품목`}>
            {items.map((entry, index) => (
              <i key={entry.id} className={index < step || result ? 'did' : index === step ? 'on' : ''} />
            ))}
          </div>
        ) : (
          <p className="hint">오늘의 품목을 고르고 있어요.</p>
        )}
        {item && !shown && !result ? (
          <>
            <PriceQuestion item={item} />
            <p className="hint">그때 얼마였을까요?</p>
            <div className="bignum blue" aria-live="polite" aria-label={`가격 추정 ${guess.toLocaleString('ko-KR')}원`}>
              ₩{guess.toLocaleString('ko-KR')}
            </div>
            <div className="price-pad">
              {keys.map((key) => (
                <button key={key} className="btn ghost" type="button" onClick={() => typeDigit(key)}>
                  {key}
                </button>
              ))}
              <button className="btn ghost erase" type="button" onClick={() => setDigits((prev) => prev.slice(0, -1))}>
                지움
              </button>
            </div>
            <button className="btn blue" type="button" disabled={guess <= 0} onClick={decide}>
              이 값으로 결정
            </button>
          </>
        ) : null}
        {shown ? <Reveal round={shown} last={rounds.length === 4} onNext={onward} /> : null}
        {result && items ? (
          <div className="panel" role="status">
            <span className="lbl">그때 그 가격 결과</span>
            <b className="plain">
              {starSum}
              <small> / 15</small>
            </b>
            <p>정확도 {result.score.toLocaleString('ko-KR')} / 1,000점</p>
            <p className="hint">{result.kind === 'ranked' ? rankLine(result.rank, result.participants) : result.message}</p>
            <ul className="price-recap">
              {rounds.map((round) => (
                <li key={round.item.id}>
                  <b>{priceLabel(round.item)}</b>
                  <span>정답 {priceWon(round.item)}</span>
                  <span>내 추정 {round.guess.toLocaleString('ko-KR')}원</span>
                  <span>
                    {'★'.repeat(priceStars(round.guess, round.item.price)) || '☆'} {pricePoint(round.guess, round.item.price)}점
                  </span>
                  <a href={round.item.source_url} target="_blank" rel="noreferrer">
                    출처: {round.item.source_name}
                  </a>
                </li>
              ))}
            </ul>
            <div className="form-actions">
              <button className="btn sm" type="button" onClick={() => setShare(true)}>
                결과 공유
              </button>
            </div>
          </div>
        ) : null}
      </div>
      {share && result ? <ShareSheet slug={service.slug} title={`${starSum} / 15`} text={shareText} onClose={() => setShare(false)} /> : null}
    </GameFrame>
  );
}

function PriceQuestion({ item }: { item: PriceItem }) {
  const words = [`${item.year}년`, ...item.name.split(/\s+/).filter(Boolean), `(${item.unit})`];
  return (
    <b className="price-q">
      {words.map((word, index) => (
        <span key={`${word}-${index}`}>{word}</span>
      ))}
    </b>
  );
}

function Reveal({ round, last, onNext }: { round: Round; last: boolean; onNext: () => void }) {
  const stars = priceStars(round.guess, round.item.price);
  const max = Math.max(round.guess, round.item.price);
  const error = Math.round((Math.abs(round.guess - round.item.price) / round.item.price) * 100);
  return (
    <div className="panel price-reveal" role="status">
      <b>{priceLabel(round.item)}</b>
      <div className="cmp">
        <div>
          <span className="row">
            <b>정답</b>
            <b>{priceWon(round.item)}</b>
          </span>
          <i className="bar">
            <i style={{ width: `${(round.item.price / max) * 100}%` }} />
          </i>
        </div>
        <div>
          <span className="row">
            <span>내 추정</span>
            <span>{round.guess.toLocaleString('ko-KR')}원</span>
          </span>
          <i className="bar mine">
            <i style={{ width: `${(round.guess / max) * 100}%` }} />
          </i>
        </div>
      </div>
      <p aria-label={`별 ${stars}개`}>
        {'★'.repeat(stars)}
        <span className="dim">{'★'.repeat(3 - stars)}</span>
      </p>
      <p className="hint">차이 {error}%.</p>
      <a href={round.item.source_url} target="_blank" rel="noreferrer">
        출처: {round.item.source_name}
      </a>
      <button className="btn blue" type="button" onClick={onNext}>
        {last ? '오늘 결과 보기' : '다음 품목'}
      </button>
    </div>
  );
}
