'use client';

import { ColorGame } from '@/components/games/ColorGame';
import { DongneGame } from '@/components/games/DongneGame';
import { DrawGame } from '@/components/games/DrawGame';
import { EarnedGame } from '@/components/games/EarnedGame';
import { LunchGame } from '@/components/games/LunchGame';
import { NumberGame } from '@/components/games/NumberGame';
import { PriceGame } from '@/components/games/PriceGame';
import { ReactionGame } from '@/components/games/ReactionGame';
import { RoomGame } from '@/components/games/RoomGame';
import { ShapeGame } from '@/components/games/ShapeGame';
import { TenSec } from '@/components/games/TenSec';
import { WearGame } from '@/components/games/WearGame';
import { CountGame } from '@/components/games/CountGame';
import { MajorityGame } from '@/components/games/MajorityGame';
import { LowestGame } from '@/components/games/LowestGame';
import { FishGame } from '@/components/games/FishGame';
import { ForecastGame } from '@/components/games/ForecastGame';
import { OffworkGame } from '@/components/games/OffworkGame';
import { LunchRankGame } from '@/components/games/LunchRankGame';
import { PuzzleGame } from '@/components/games/PuzzleGame';
import { serviceBySlug } from '@/content/services';
import type { FishBoard } from '@/lib/fish-read';

export function GameView({ slug, dongne, dots, fish }: { slug: string; dongne?: { code: string; path: string; easyCode: string; easyPath: string; sidos: { code: string; label: string; lat: number; lng: number }[] }; dots?: { x: number; y: number; c: number }[]; fish?: FishBoard | null }) {
  const service = serviceBySlug(slug);
  if (!service) return null;
  if (service.id === 1) return <TenSec />;
  if (service.id === 2) return <ColorGame />;
  if (service.id === 3) return <ShapeGame />;
  if (service.id === 4) return <PriceGame />;
  if (service.id === 5) return dongne ? <DongneGame day={dongne} /> : null;
  if (service.id === 6) return <NumberGame />;
  if (service.id === 7) return <WearGame />;
  if (service.id === 8) return <EarnedGame />;
  if (service.id === 9) return <LunchGame />;
  if (service.id === 10) return <DrawGame />;
  if (service.id === 11) return <CountGame dots={dots ?? []} />;
  if (service.id === 12) return <MajorityGame />;
  if (service.id === 13) return <LowestGame />;
  if (service.id === 14) return <FishGame initial={fish} />;
  if (service.id === 15) return <PuzzleGame />;
  if (service.id === 16) return <ForecastGame />;
  if (service.id === 18) return <RoomGame />;
  if (service.id === 19) return <OffworkGame />;
  if (service.id === 20) return <LunchRankGame />;
  return <ReactionGame />;
}
