import type { Metadata } from 'next';
import { connection } from 'next/server';
import { notFound } from 'next/navigation';
import { GameView } from '@/components/games/GameView';
import { serviceBySlug, services } from '@/content/services';
import { kstDateKey } from '@/lib/daily';
import { todayDongneView } from '@/lib/games/dongne-shape';
import { todayJar } from '@/lib/games/count';
import { ensureCountAnswer } from '@/lib/count-answer';
import { readFishBoard } from '@/lib/fish-read';

export function generateStaticParams() {
  return services.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const service = serviceBySlug(slug);
  if (!service) return {};
  return {
    title: service.title,
    description: service.line,
    openGraph: { title: service.title, description: service.line },
  };
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = serviceBySlug(slug);
  if (!service) notFound();
  if (service.id === 5) return <GameView slug={slug} dongne={todayDongneView(kstDateKey())} />;
  if (service.id === 14) {
    await connection();
    return <GameView slug={slug} fish={await readFishBoard()} />;
  }
  if (service.id === 11) {
    const key = kstDateKey();
    const jar = todayJar(key);
    await ensureCountAnswer(key, jar.dots.length);
    return <GameView slug={slug} dots={jar.dots} />;
  }
  return <GameView slug={slug} />;
}
