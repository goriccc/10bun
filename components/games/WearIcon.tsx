const PATHS = {
  sleeveless: 'M48 14c-6 10-10 16-12 22L32 92h56L84 36c-2-6-6-12-12-22-8 10-16 10-24 0z',
  tee: 'M38 18 22 26 12 46l16 8 6-10v48h52V44l6 10 16-8-10-20-16-8c-4 8-12 12-22 12s-18-4-22-12z',
  shirt: 'M38 16 20 24 10 70l14 4 8-34v54h56V40l8 34 14-4-10-46-18-8c-4 8-12 12-22 12s-18-4-22-12z',
  knit: 'M42 18 26 28 12 54l16 6 6-16v42h56V44l6 16 16-6-14-26-16-10c-8 10-20 10-28 0z',
  hoodie: 'M60 6c-16 0-24 12-24 22l-14 6-12 22 16 6 6-16v44h56V46l6 16 16-6-12-22-14-6c0-10-8-22-24-22z',
  dress: 'M50 12c-6 10-10 14-12 20L18 100h84L82 32c-2-6-6-10-12-20-8 10-12 10-20 0z',
  jacket: 'M44 12 24 22 14 58l16 6 6-24v36h44V40l6 24 16-6-10-36-20-10-12 18-4 10-4-10z',
  coat: 'M36 12 16 22 8 82l18 4 6-40v56h56V46l6 40 18-4-8-60-20-10-24 34z',
  pad: 'M34 12 14 24 6 84l20 4 6-36v52h56V52l6 36 20-4-8-60-20-12c-6 6-14 9-26 9s-20-3-26-9z',
} as const;

export type WearIconName = keyof typeof PATHS;

export function WearIcon({ kind, size = 120 }: { kind: WearIconName; size?: number }) {
  return (
    <svg viewBox="0 0 120 104" width={size} height={size * (104 / 120)} aria-hidden="true">
      <path d={PATHS[kind]} fill="currentColor" />
    </svg>
  );
}
