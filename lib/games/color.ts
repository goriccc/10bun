import { daily, dateFromKey } from '../daily';

export type Hsb = [number, number, number];

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function hsb2rgb(h: number, s: number, b: number): [number, number, number] {
  s /= 100;
  b /= 100;
  const k = (n: number) => (n + h / 60) % 6;
  const f = (n: number) => b * (1 - s * Math.max(0, Math.min(k(n), 4 - k(n), 1)));
  return [Math.round(f(5) * 255), Math.round(f(3) * 255), Math.round(f(1) * 255)];
}

function rgb2lab(r: number, g: number, b: number): [number, number, number] {
  let R = r / 255;
  let G = g / 255;
  let B = b / 255;
  R = R > 0.04045 ? ((R + 0.055) / 1.055) ** 2.4 : R / 12.92;
  G = G > 0.04045 ? ((G + 0.055) / 1.055) ** 2.4 : G / 12.92;
  B = B > 0.04045 ? ((B + 0.055) / 1.055) ** 2.4 : B / 12.92;
  let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  let y = (R * 0.2126 + G * 0.7152 + B * 0.0722) / 1;
  let z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  x = f(x);
  y = f(y);
  z = f(z);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

function dE(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function todayColors(serverDate: string): Hsb[] {
  const rand = daily(2, dateFromKey(serverDate));
  const colors: Hsb[] = [];
  for (let i = 0; i < 5; i += 1) {
    colors.push([Math.round(rand() * 360), Math.round(35 + rand() * 60), Math.round(42 + rand() * 55)]);
  }
  return colors;
}

export function hsbCss(h: number, s: number, b: number): string {
  const [r, g, bl] = hsb2rgb(h, s, b);
  return `rgb(${r}, ${g}, ${bl})`;
}

export function colorPoint(target: Hsb, pick: Hsb): number {
  const dist = dE(hsb2rgb(...target), hsb2rgb(...pick));
  return Math.round(1000 * Math.exp(-dist / 26)) / 100;
}

export function colorTotal(targets: Hsb[], picks: Hsb[]): number {
  return round2(targets.reduce((sum, target, i) => sum + colorPoint(target, picks[i]), 0));
}

function isHsb(value: unknown): value is Hsb {
  if (!Array.isArray(value) || value.length !== 3) return false;
  const [h, s, b] = value;
  return [h, s, b].every((n) => typeof n === 'number' && Number.isFinite(n)) && h >= 0 && h <= 360 && s >= 0 && s <= 100 && b >= 0 && b <= 100;
}

export function verify(
  serverDate: string,
  score: number,
  meta: unknown,
): { ok: true; score: number } | { ok: false } {
  if (typeof score !== 'number' || !Number.isFinite(score)) return { ok: false };
  const picks = meta && typeof meta === 'object' ? (meta as { picks?: unknown }).picks : undefined;
  if (!Array.isArray(picks) || picks.length !== 5 || !picks.every(isHsb)) return { ok: false };
  const calc = colorTotal(todayColors(serverDate), picks);
  if (Math.abs(calc - score) > 0.05) return { ok: false };
  return { ok: true, score: calc };
}
