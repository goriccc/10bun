import type { Metadata } from 'next';
import { RoomGame } from '@/components/games/RoomGame';

export const metadata: Metadata = {
  title: '친구 대결방',
  description: '1~6번 게임을 친구들과 같은 문제로 7일간 겨루는 방',
};

export default async function RoomInvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <RoomGame code={code} />;
}
