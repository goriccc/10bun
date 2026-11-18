import Link from 'next/link';
import { KstDate } from './KstDate';
import { VisitStreak } from './VisitStreak';

export function SiteHeader() {
  return (
    <header className="top">
      <div className="wrap">
        <Link className="logo" href="/" aria-label="10분닷컴 홈">
          <svg viewBox="0 0 40 40" aria-hidden="true">
            <rect x="15" y="1" width="10" height="6" rx="2" fill="#D23F48" />
            <circle cx="20" cy="22" r="17" fill="#FF5E5B" />
            <circle cx="20" cy="22" r="12.5" fill="#FCFBFF" />
            <path d="M20 22 L20 9.5 A12.5 12.5 0 0 1 32.2 19.6 Z" fill="#FFD13D" />
            <circle cx="20" cy="22" r="3" fill="#231D4B" />
          </svg>
          <div>
            <b>10분</b>
            <span>작은 즐거움, 매일 0시</span>
          </div>
        </Link>
        <KstDate />
        <VisitStreak />
      </div>
    </header>
  );
}
