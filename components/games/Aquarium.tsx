'use client';

import { useEffect, useRef } from 'react';
import { FishSprite, fishKind } from '@/components/games/fish-species';

const BUBBLES = [
  { left: '12%', size: 10, delay: '0s', duration: '6.4s' },
  { left: '22%', size: 7, delay: '1.1s', duration: '5.6s' },
  { left: '31%', size: 12, delay: '2.4s', duration: '7.2s' },
  { left: '47%', size: 8, delay: '0.4s', duration: '6s' },
  { left: '58%', size: 11, delay: '3.1s', duration: '6.8s' },
  { left: '71%', size: 7, delay: '1.7s', duration: '5.2s' },
  { left: '84%', size: 10, delay: '2.8s', duration: '6.6s' },
];

const PEBBLES = [
  [4, 18, '#C9843E'],
  [9, 13, '#8C5A2C'],
  [14, 20, '#E8C27A'],
  [20, 14, '#A56B38'],
  [26, 17, '#F0D7A0'],
  [33, 12, '#7A4E28'],
  [39, 19, '#D7A45C'],
  [46, 15, '#F6E2B0'],
  [52, 18, '#9A6234'],
  [59, 13, '#E2B56A'],
  [65, 20, '#C98942'],
  [72, 14, '#6E4524'],
  [78, 17, '#F3D59A'],
  [85, 15, '#B07840'],
  [91, 19, '#8D5C30'],
  [96, 13, '#E7C488'],
] as const;

type Pose = { x: number; y: number; dir: number; yaw: number };
let savedPose: Pose | null = null;

export function Aquarium({ swimming, generation, known, mood, feedKey }: { swimming: boolean; generation?: number; known: boolean; mood: 'ok' | 'hungry' | 'stuffed'; feedKey: number }) {
  const fishRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<SVGSVGElement>(null);
  const pelletRef = useRef<HTMLDivElement>(null);
  const feedKeyRef = useRef(feedKey);
  const swimmingRef = useRef(swimming);
  const knownRef = useRef(known);
  feedKeyRef.current = feedKey;
  swimmingRef.current = swimming;
  knownRef.current = known;

  useEffect(() => {
    const fish = fishRef.current;
    const face = faceRef.current;
    const body = bodyRef.current;
    const pellet = pelletRef.current;
    if (!fish || !face || !body || !pellet) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let x = savedPose?.x ?? 16;
    let y = savedPose?.y ?? 40;
    let dir = savedPose?.dir === -1 ? -1 : 1;
    let mode: 'swim' | 'turn' | 'chase' | 'bite' = 'swim';
    let until = 0;
    let turnStart = 0;
    let yaw = savedPose?.yaw ?? (dir === 1 ? 0 : 180);
    let turnFromYaw = 0;
    let turnDelta = 180;
    const turnMs = 700;
    let pelletOn = false;
    let px = 50;
    let py = 8;
    let pvy = 0;
    let seen = feedKeyRef.current;
    let last = performance.now();
    let swallow = 0;
    const width = 24;
    const lip = 156 / 180;
    const mouthDrop = width * (100 / 180) * (16 / 10) * (62 / 100);
    const mouthXOf = () => x + width * (dir === 1 ? lip : 1 - lip);
    const mouthYOf = () => y + mouthDrop;

    const beginTurn = (now: number) => {
      turnFromYaw = yaw;
      dir = -dir;
      turnDelta = dir === -1 ? 180 : -180;
      turnStart = now;
      mode = 'turn';
      until = now + turnMs;
    };

    const place = (now: number) => {
      const tilt = mode === 'turn' || mode === 'bite' ? 0 : Math.sin(now / 280) * 5;
      let pitch = 0;
      if (mode === 'turn' && !reduced) {
        const t = Math.min(1, (now - turnStart) / turnMs);
        const e = t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
        yaw = turnFromYaw + turnDelta * e;
        pitch = Math.sin(t * Math.PI) * 12;
      } else yaw = dir === 1 ? 0 : 180;
      savedPose = { x, y, dir, yaw };
      fish.style.left = `${x}%`;
      fish.style.top = `${y}%`;
      face.style.transform = `rotateX(${pitch}deg) rotateY(${yaw}deg)`;
      body.style.transform = `rotate(${tilt}deg)`;
      pellet.style.visibility = pelletOn ? 'visible' : 'hidden';
      pellet.style.left = `${px}%`;
      pellet.style.top = `${py}%`;
      body.classList.toggle('dash', mode === 'chase');
      body.classList.toggle('bite', mode === 'bite');
    };

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!knownRef.current) {
        place(now);
        raf = requestAnimationFrame(frame);
        return;
      }
      if (!swimmingRef.current) {
        y += (8 - y) * Math.min(1, dt * 2);
        body.classList.remove('dash', 'bite');
        place(now);
        raf = requestAnimationFrame(frame);
        return;
      }
      if (feedKeyRef.current !== seen) {
        seen = feedKeyRef.current;
        if (seen > 0) {
          pelletOn = true;
          px = 14 + Math.random() * 62;
          py = 4;
          pvy = 8;
          mode = 'chase';
        }
      }
      if (reduced) {
        place(now);
        raf = requestAnimationFrame(frame);
        return;
      }
      if (pelletOn && mode !== 'bite') {
        pvy = Math.min(26, pvy + 22 * dt);
        py += pvy * dt;
        px += Math.sin(now / 160) * 6 * dt;
        if (py > 72) {
          py = 72;
          pvy = 0;
        }
      }
      const idleY = 38 + Math.sin(now / 900) * 8;
      if (mode === 'turn') {
        if (now >= until) mode = pelletOn ? 'chase' : 'swim';
      } else if (mode === 'bite') {
        if (pelletOn && now >= swallow) pelletOn = false;
        if (now >= until) mode = 'swim';
      } else if (mode === 'chase' && pelletOn) {
        const dx = px - mouthXOf();
        const dy = py - mouthYOf();
        const ahead = dir === 1 ? dx >= -1.2 : dx <= 1.2;
        const tailX = dir === 1 ? x + width * 0.08 : x + width * 0.92;
        const tailClear = dir === 1 ? tailX > px + 1.5 : tailX < px - 1.5;
        const atWall = dir === 1 ? x >= 70 : x <= 3;
        if (Math.abs(dx) < 2.2 && Math.abs(dy) < 3.2) {
          mode = 'bite';
          until = now + 560;
          swallow = now + 200;
        } else if (ahead) {
          const step = 34 * dt;
          if (dir === 1) x += Math.min(step, Math.max(0, dx));
          else x -= Math.min(step, Math.max(0, -dx));
          y += Math.sign(dy) * Math.min(Math.abs(dy), 28 * dt);
        } else if (!tailClear && !atWall) {
          x += dir * 30 * dt;
          y += Math.sign(dy) * Math.min(Math.abs(dy), 28 * dt);
        } else {
          beginTurn(now);
        }
      } else {
        x += dir * 13 * dt;
        y += (idleY - y) * Math.min(1, dt * 1.6);
        if ((dir === 1 && x > 70) || (dir === -1 && x < 3)) {
          x = dir === 1 ? 70 : 3;
          beginTurn(now);
        }
      }
      x = Math.max(1, Math.min(72, x));
      y = Math.max(16, Math.min(64, y));
      if (mode === 'bite' && pelletOn) {
        px = mouthXOf();
        py = mouthYOf();
      }
      place(now);
      raf = requestAnimationFrame(frame);
    };

    place(performance.now());
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      <div className="tank-glow" />
      <svg className="plant back" viewBox="0 0 90 180" aria-hidden="true">
        <path d="M46 180 C40 120 18 90 24 28" />
        <path d="M46 180 C52 110 74 80 68 18" />
        <path d="M46 180 C44 100 46 60 40 8" />
      </svg>
      <svg className="plant left" viewBox="0 0 120 200" aria-hidden="true">
        <path d="M70 200 C60 140 20 120 18 70" />
        <path d="M70 200 C66 130 40 100 48 40" />
        <path d="M70 200 C78 120 96 90 92 36" />
        <ellipse cx="22" cy="78" rx="16" ry="8" transform="rotate(-30 22 78)" />
        <ellipse cx="50" cy="48" rx="14" ry="7" transform="rotate(-18 50 48)" />
        <ellipse cx="90" cy="46" rx="15" ry="7" transform="rotate(24 90 46)" />
      </svg>
      <svg className="plant right" viewBox="0 0 130 210" aria-hidden="true">
        <path d="M40 210 C36 150 8 120 16 62" />
        <path d="M48 210 C58 140 96 110 108 48" />
        <path d="M44 210 C46 130 70 90 64 20" />
        <ellipse cx="20" cy="70" rx="18" ry="8" transform="rotate(-36 20 70)" />
        <ellipse cx="104" cy="56" rx="18" ry="8" transform="rotate(28 104 56)" />
        <ellipse cx="66" cy="28" rx="12" ry="6" transform="rotate(-8 66 28)" />
      </svg>
      <div className="rock" />
      <div className="sand" />
      <div className="pebbles" aria-hidden="true">
        {PEBBLES.map(([left, size, fill]) => (
          <i key={`${left}-${size}`} style={{ left: `${left}%`, width: size, height: size * 0.72, background: fill }} />
        ))}
      </div>
      {BUBBLES.map((bubble) => (
        <i
          key={bubble.left}
          className="bubble"
          style={{ left: bubble.left, width: bubble.size, height: bubble.size, animationDelay: bubble.delay, animationDuration: bubble.duration }}
        />
      ))}
      <div ref={pelletRef} className="pellet" />
      <div ref={fishRef} className={`fish${known ? '' : ' wait'}${known && !swimming ? ' gone' : ''}${known && swimming && mood === 'hungry' ? ' hungry' : ''}${known && swimming && mood === 'stuffed' ? ' stuffed' : ''}`}>
        <div className="fish-ink">
          <div ref={faceRef} className="fish-face">
            <svg ref={bodyRef} viewBox="0 0 180 100" aria-hidden="true">
              <FishSprite kind={fishKind(generation)} />
            </svg>
          </div>
        </div>
      </div>
    </>
  );
}
