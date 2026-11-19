'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { AdSlot } from '@/components/AdSlot';
import { ProfileForm } from '@/components/ProfileForm';
import { RankBoard } from '@/components/RankBoard';
import { ShareBar } from '@/components/ShareBar';
import { AD_SLOTS } from '@/content/ads';
import { guideKeep, guides } from '@/content/guides';
import { services, type Service } from '@/content/services';
import type { DeviceProfile } from '@/lib/device';

export function GameFrame({
  service,
  children,
  notice,
  rolled,
  playing,
  revision,
  profile,
  needEdit,
  onSave,
  side,
  shareText,
}: {
  service: Service;
  children: ReactNode;
  notice?: string;
  rolled?: boolean;
  playing?: boolean;
  revision: number;
  profile: DeviceProfile | null;
  needEdit?: boolean;
  onSave: (next: DeviceProfile) => Promise<{ ok?: boolean; code?: string }>;
  side?: ReactNode;
  shareText?: string;
}) {
  const index = services.findIndex((item) => item.id === service.id);
  const prev = services[(index - 1 + services.length) % services.length];
  const next = services[(index + 1) % services.length];
  const guide = guides[service.id];
  return (
    <article className={`wrap detail g-${service.color}`}>
      <Link className="back" href="/">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M10 3 5 8l5 5" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        전체 목록
      </Link>
      <header className="d-head">
        <div className="d-badge">{service.id}</div>
        <div className="d-title">
          <h1>{service.title}</h1>
          <ShareBar service={service} hidden={playing} resultText={shareText} />
        </div>
        <p>{service.line}</p>
        <div className="d-facts">
          <span className="chip">{service.group}</span>
          <span className="chip tm">{service.time}</span>
          <span className="chip">{service.reset}</span>
          {service.ranked ? <span className="chip rk">전국 순위</span> : null}
          {service.shared ? <span className="chip srv">서버 집계</span> : service.ranked ? <span className="chip">게임은 서버 없이, 순위만 서버</span> : <span className="chip">서버 없이 동작</span>}
        </div>
      </header>
      {rolled ? (
        <div className="banner">
          새 문제가 열렸어요
          <button className="btn sm" type="button" onClick={() => window.location.reload()}>
            새로고침
          </button>
        </div>
      ) : null}
      {notice ? <p className="banner soft">{notice}</p> : null}
      {needEdit && profile ? <ProfileForm profile={profile} onSave={onSave} /> : null}
      <div className="d-grid">
        <div>
          <section className="machine">
            <div className="screen">{children}</div>
          </section>
          {service.ranked ? <RankBoard gameId={service.id} revision={revision} profile={profile} onSave={onSave} /> : null}
          {service.ranked ? (
            <>
              <AdSlot slot={AD_SLOTS.moDetailRank} device="mobile" className="compact" />
              <AdSlot slot={AD_SLOTS.pcDetailRank} device="desktop" className="compact" />
            </>
          ) : null}
        </div>
        <div className="guide-col">
          <aside className="guide">
            {side}
            <h2>하는 법</h2>
            <p>{guide?.how}</p>
            <h2>규칙</h2>
            <p>{guide?.rules}</p>
            {service.ranked ? <p>{guideKeep}</p> : null}
            <h2>자주 묻는 질문</h2>
            <dl>
              {guide?.faq.map((item) => (
                <div key={item.q}>
                  <dt>{item.q}</dt>
                  <dd>{item.a}</dd>
                </div>
              ))}
            </dl>
          </aside>
          {service.ad ? <AdSlot slot={AD_SLOTS.pcDetailGuide} device="desktop" format="vertical" className="guide-ad" /> : null}
        </div>
      </div>
      <nav className="pager" aria-label="다른 놀이">
        <Link href={`/${prev.slug}`}>
          <small>이전 {prev.id}번</small>
          <b>{prev.title}</b>
        </Link>
        <Link className="next" href={`/${next.slug}`}>
          <small>다음 {next.id}번</small>
          <b>{next.title}</b>
        </Link>
      </nav>
    </article>
  );
}
