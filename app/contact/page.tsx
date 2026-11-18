import type { Metadata } from 'next';
import { DeviceIdNote } from '@/components/DeviceIdNote';

export const metadata: Metadata = {
  title: '문의',
  description: '10분닷컴 문의와 기록 삭제 요청 안내예요.',
};

export default function ContactPage() {
  return (
    <div className="wrap page">
      <article className="prose">
        <h1>문의</h1>
        <p>
          10분닷컴은 멀티파이프(대표 송준호)가 운영해요. 문의는 <a href="mailto:contact@10bun.com">contact@10bun.com</a>으로 보내 주세요.
        </p>
        <h2>기록 삭제 요청</h2>
        <p>순위 기록 삭제를 원하면 문의에 기기 ID를 함께 보내 주세요. 운영자가 그 기기의 기록을 삭제해요.</p>
        <DeviceIdNote />
        <p>별명에 실명을 쓰지 말아 주세요. 만 14세 미만도 별도의 개인정보를 받지 않아요.</p>
      </article>
    </div>
  );
}
