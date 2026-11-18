import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '개인정보처리방침',
  description: '10분닷컴이 다루는 정보와 보관 기간이에요.',
};

export default function PrivacyPage() {
  return (
    <div className="wrap page">
      <article className="prose">
        <h1>개인정보처리방침</h1>
        <p>10분닷컴은 로그인 없이 순위를 운영해요. 이름, 연락처, 위치는 받지 않아요.</p>

        <h2>수집 항목</h2>
        <ul>
          <li>브라우저가 만든 무작위 기기 ID</li>
          <li>별명</li>
          <li>시도</li>
          <li>게임 기록</li>
          <li>날짜마다 바뀌는 IP 해시</li>
        </ul>

        <h2>이용 목적</h2>
        <p>순위를 운영하고, 부정 이용을 막기 위해 사용해요.</p>

        <h2>보관과 파기</h2>
        <ul>
          <li>게임 기록은 30일 동안 보관해요.</li>
          <li>하루 상위 100명의 별명과 기록은 400일 동안 보관해요.</li>
          <li>마지막 방문 후 90일이 지난 프로필은 삭제해요.</li>
        </ul>
        <p>기간이 지나면 매일 자동으로 삭제해요.</p>

        <h2>처리 위탁과 국외 이전</h2>
        <table>
          <thead>
            <tr>
              <th>수탁자</th>
              <th>항목</th>
              <th>국가</th>
              <th>목적</th>
              <th>보관</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Supabase</td>
              <td>기기 ID, 별명, 시도, 게임 기록, IP 해시</td>
              <td>싱가포르</td>
              <td>순위 데이터베이스</td>
              <td>위 보관 기간과 같아요</td>
            </tr>
            <tr>
              <td>Vercel</td>
              <td>접속에 필요한 기술 정보</td>
              <td>싱가포르</td>
              <td>웹 호스팅</td>
              <td>호스팅 제공자의 기간을 따라요</td>
            </tr>
            <tr>
              <td>Google</td>
              <td>쿠키를 통한 방문 정보</td>
              <td>미국</td>
              <td>광고(애드센스)와 방문 통계(애널리틱스)</td>
              <td>Google 정책의 기간을 따라요</td>
            </tr>
          </tbody>
        </table>

        <h2>쿠키와 기기 저장소</h2>
        <p>애드센스와 Google 애널리틱스 쿠키를 사용할 수 있어요. 기기 ID와 별명, 연속 방문은 브라우저 저장소에 있어요.</p>
        <p>
          <a href="https://policies.google.com/technologies/partner-sites">Google 파트너 사이트 정책</a>에서 쿠키 사용을 확인할 수 있어요.
        </p>
        <p>
          맞춤 광고는 <a href="https://adssettings.google.com">Google 광고 설정</a>에서 끌 수 있어요. 브라우저 설정에서 쿠키를 차단할 수도 있어요.
        </p>
        <p>저장소를 지우면 이 브라우저의 별명과 기기 ID가 새로 시작돼요.</p>

        <h2>이용자 권리</h2>
        <p>
          기록 삭제를 요청할 수 있어요. <Link href="/contact">문의</Link> 페이지에서 기기 ID를 함께 보내 주세요. 운영자는 그 기기의 기록을 삭제해요.
        </p>

        <h2>만 14세 미만</h2>
        <p>별도의 개인정보를 받지 않아요. 별명에 실명을 쓰지 말아 주세요.</p>

        <h2>개인정보 보호책임자</h2>
        <p>
          멀티파이프(대표 송준호). 연락은 <a href="mailto:contact@10bun.com">contact@10bun.com</a>으로 보내 주세요.
        </p>
      </article>
    </div>
  );
}
