import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '소개',
  description: '10분닷컴은 매일 0시에 바뀌는 10분짜리 작은 즐거움이에요.',
};

export default function AboutPage() {
  return (
    <div className="wrap page">
      <article className="prose">
        <h1>소개</h1>
        <p>10분닷컴은 매일 0시에 바뀌는 10분짜리 작은 즐거움이에요. 멀티파이프가 운영해요.</p>
        <p>하루의 기준은 한국 시간이에요. 그날의 문제는 어디에 있든 같아요.</p>
        <p>로그인은 없어요. 순위는 이 브라우저에 저장된 기기 ID와 별명으로 참여해요.</p>
        <p>기록은 30일 동안 보관돼요. 사람 한계에 가까운 기록은 확인 후 순위에 들어가요.</p>
      </article>
    </div>
  );
}
