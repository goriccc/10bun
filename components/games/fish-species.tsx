export type FishKind = {
  name: string;
  body: string;
  fin: string;
  belly: string;
  shape: 'round' | 'slim' | 'tall';
  tail: 'round' | 'fork' | 'fan' | 'long';
  dorsal: 'tall' | 'short' | 'none';
  mark: 'none' | 'spots' | 'bands' | 'line' | 'stripe';
};

export const FISH_KINDS: FishKind[] = [
  { name: '금붕어', body: '#FF9A3D', fin: '#E36B12', belly: '#FFE0B8', shape: 'round', tail: 'round', dorsal: 'tall', mark: 'none' },
  { name: '홍백', body: '#F4F1EA', fin: '#E23B3B', belly: '#FFE4E4', shape: 'round', tail: 'round', dorsal: 'short', mark: 'spots' },
  { name: '난주', body: '#FF7A1A', fin: '#C45100', belly: '#FFD0A8', shape: 'round', tail: 'fan', dorsal: 'none', mark: 'none' },
  { name: '코메트', body: '#F4A259', fin: '#E07A2F', belly: '#FFE3C4', shape: 'slim', tail: 'long', dorsal: 'short', mark: 'none' },
  { name: '셔브킨', body: '#F2C14E', fin: '#3D6BFF', belly: '#FFF3C9', shape: 'round', tail: 'round', dorsal: 'tall', mark: 'spots' },
  { name: '구피', body: '#FF8BB8', fin: '#7A4DFF', belly: '#FFE0EE', shape: 'slim', tail: 'fan', dorsal: 'short', mark: 'none' },
  { name: '네온테트라', body: '#D5DEE6', fin: '#9FB4C4', belly: '#F7FBFF', shape: 'slim', tail: 'fork', dorsal: 'short', mark: 'line' },
  { name: '베타', body: '#E23B4A', fin: '#FF8BA7', belly: '#FFC2CB', shape: 'slim', tail: 'fan', dorsal: 'tall', mark: 'none' },
  { name: '엔젤', body: '#F4E4C4', fin: '#F7F3EA', belly: '#FFF8EE', shape: 'tall', tail: 'fork', dorsal: 'tall', mark: 'bands' },
  { name: '구라미', body: '#7EC8A3', fin: '#1F6B4A', belly: '#D7F5E6', shape: 'round', tail: 'round', dorsal: 'tall', mark: 'spots' },
  { name: '클리너', body: '#F7F3EA', fin: '#231D4B', belly: '#FFFFFF', shape: 'slim', tail: 'fork', dorsal: 'short', mark: 'stripe' },
  { name: '블랙몰리', body: '#2C2C34', fin: '#111118', belly: '#4A4A55', shape: 'slim', tail: 'round', dorsal: 'short', mark: 'none' },
  { name: '플래티', body: '#FF8A3D', fin: '#FFD13D', belly: '#FFE0C2', shape: 'round', tail: 'fork', dorsal: 'short', mark: 'none' },
  { name: '제브라', body: '#E8EEF6', fin: '#4B5BFF', belly: '#FFFFFF', shape: 'slim', tail: 'fork', dorsal: 'short', mark: 'stripe' },
  { name: '디스커스', body: '#F2D2B3', fin: '#E07A3D', belly: '#FFF0E4', shape: 'tall', tail: 'round', dorsal: 'tall', mark: 'bands' },
  { name: '카디널', body: '#C5D0D8', fin: '#FF3B4E', belly: '#FF8A96', shape: 'slim', tail: 'fork', dorsal: 'short', mark: 'line' },
  { name: '레인보우', body: '#F7C6E0', fin: '#7AA2FF', belly: '#FFF0F8', shape: 'slim', tail: 'fan', dorsal: 'tall', mark: 'line' },
  { name: '버터플라이', body: '#FFE27A', fin: '#231D4B', belly: '#FFF6C9', shape: 'tall', tail: 'fan', dorsal: 'tall', mark: 'bands' },
  { name: '오스카', body: '#E07A3D', fin: '#8A3E16', belly: '#F6C39A', shape: 'round', tail: 'round', dorsal: 'tall', mark: 'spots' },
  { name: '백운산', body: '#F4F7FB', fin: '#E23B4A', belly: '#FFFFFF', shape: 'slim', tail: 'fork', dorsal: 'short', mark: 'none' },
];

export function fishKind(generation?: number): FishKind {
  const index = (Math.max(1, Number(generation) || 1) - 1) % FISH_KINDS.length;
  return FISH_KINDS[index] ?? FISH_KINDS[0];
}

const BODIES = {
  round: 'M54 50 C66 20 112 14 146 36 C162 46 162 64 146 74 C112 92 66 84 54 50Z',
  slim: 'M48 50 C72 34 114 30 146 40 C162 46 162 62 146 68 C112 76 70 70 48 50Z',
  tall: 'M58 50 C72 10 118 8 146 34 C162 46 162 64 146 76 C116 98 72 96 58 50Z',
};

const TAILS = {
  round: 'M58 50 C34 24 10 16 8 38 C6 50 12 58 8 74 C14 92 36 76 58 50Z',
  fork: 'M58 50 C36 34 16 22 4 28 C18 46 18 54 4 74 C16 80 36 68 58 50Z',
  fan: 'M58 50 C28 16 2 28 4 50 C2 74 28 86 58 50Z',
  long: 'M58 50 C34 32 6 28 -6 40 C6 50 -6 62 6 74 C34 70 58 50 58 50Z',
};

const DORSALS = {
  tall: 'M86 34 C96 8 122 10 132 32 C118 28 100 30 86 34Z',
  short: 'M100 36 C108 22 124 22 130 36 C120 34 108 34 100 36Z',
  none: '',
};

export function FishSprite({ kind }: { kind: FishKind }) {
  return (
    <>
      <g className="fin-tail" style={{ fill: kind.fin }}>
        <path d={TAILS[kind.tail]} />
      </g>
      {kind.dorsal !== 'none' ? (
        <g className="fin-dorsal" style={{ fill: kind.fin }}>
          <path d={DORSALS[kind.dorsal]} />
        </g>
      ) : null}
      <path className="body" d={BODIES[kind.shape]} style={{ fill: kind.body }} />
      <path d="M96 58 C112 70 136 66 148 56 C134 68 112 70 96 58Z" fill={kind.belly} />
      {kind.mark === 'spots' ? (
        <g fill={kind.fin} opacity="0.85">
          <circle cx="96" cy="46" r="5" />
          <circle cx="112" cy="58" r="4" />
          <circle cx="124" cy="44" r="3.5" />
        </g>
      ) : null}
      {kind.mark === 'bands' ? (
        <g fill={kind.fin} opacity="0.8">
          <path d="M100 28 C108 40 108 64 100 78 L108 78 C116 62 116 42 108 28Z" />
          <path d="M118 30 C126 42 126 64 118 76 L126 76 C134 62 134 42 126 30Z" />
        </g>
      ) : null}
      {kind.mark === 'stripe' ? (
        <g stroke={kind.fin} strokeWidth="3" fill="none" strokeLinecap="round">
          <path d="M78 44 H132" />
          <path d="M82 52 H136" />
          <path d="M86 60 H130" />
        </g>
      ) : null}
      {kind.mark === 'line' ? <path d="M70 50 H140" stroke={kind.fin} strokeWidth="4" strokeLinecap="round" /> : null}
      <g className="fin-gill" style={{ fill: kind.fin }}>
        <path d="M114 48 C98 44 92 58 106 66 C116 60 118 52 114 48Z" />
      </g>
      <path d="M122 36 C112 44 112 56 120 64" fill="none" stroke="rgba(35,29,75,.28)" strokeWidth="2" strokeLinecap="round" />
      <g className="fin-anal" style={{ fill: kind.fin }}>
        <path d="M86 72 C78 86 96 88 108 74Z" />
      </g>
      <g className="mouth">
        <path d="M150 58 C156 60 158 64 152 66" fill="none" stroke="#231D4B" strokeWidth="2" strokeLinecap="round" />
      </g>
      <circle cx="136" cy="44" r="8" fill="#fff" />
      <circle cx="138" cy="44" r="4" fill="#231D4B" />
      <circle cx="139.5" cy="42.5" r="1.4" fill="#fff" />
    </>
  );
}
