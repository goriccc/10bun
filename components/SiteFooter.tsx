import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="foot">
      <div className="wrap">
        <span>10분닷컴</span>
        <nav aria-label="안내">
          <Link href="/about">소개</Link>
          <Link href="/privacy">개인정보처리방침</Link>
          <Link href="/terms">이용약관</Link>
          <Link href="/contact">문의</Link>
        </nav>
      </div>
    </footer>
  );
}
