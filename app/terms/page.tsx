import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '이용약관',
  description: '10분닷컴 이용약관이에요.',
};

export default function TermsPage() {
  return (
    <div className="wrap page">
      <article className="prose">
        <h1>이용약관</h1>
        <p>10분닷컴은 매일 한국 시간 0시에 내용이 바뀌는 작은 놀이예요. 로그인 없이 이용해요.</p>
        <h2>순위</h2>
        <p>공식 도전의 기록만 순위에 올라요. 연습으로 한 판은 순위에 들어가지 않아요.</p>
        <p>같은 기록이면 먼저 낸 사람이 앞이에요. 순위는 매일 0시에 초기화돼요.</p>
        <h2>부정 이용</h2>
        <p>부정한 방법으로 낸 기록은 순위에서 빠질 수 있어요. 그 기기의 순위 참여를 제한할 수도 있어요.</p>
        <h2>서비스 변경</h2>
        <p>놀이의 구성과 규칙은 바뀔 수 있어요. 중요한 변경은 이 페이지에 반영해요.</p>
        <h2>기록</h2>
        <p>게임 기록은 30일 동안 보관돼요. 보관과 삭제 방법은 개인정보처리방침에 적혀 있어요.</p>
      </article>
    </div>
  );
}
