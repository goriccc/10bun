'use client';

import { useState } from 'react';
import { ShareSheet } from '@/components/ShareSheet';
import type { Service } from '@/content/services';
import { track } from '@/lib/analytics';
import { inviteShareText } from '@/lib/share-text';
import { shareLink } from '@/lib/share';

export function ShareBar({
  service,
  hidden,
  resultText,
}: {
  service: Service;
  hidden?: boolean;
  resultText?: string;
}) {
  const [open, setOpen] = useState(false);
  if (hidden) return null;
  const text = resultText?.trim() ? resultText : inviteShareText(service);
  const kind = resultText?.trim() ? 'result' : 'invite';
  const heading = `10분닷컴 - ${service.title}`;
  const url = shareLink(service.slug, 'native', undefined, kind);

  const onShare = () => {
    track('share_open', { game: service.slug, kind, source: 'bar' });
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      void navigator
        .share({ title: heading, text, url })
        .then(() => track('share_native', { game: service.slug, kind, source: 'bar' }))
        .catch((err: unknown) => {
          if (err && typeof err === 'object' && 'name' in err && (err as { name?: string }).name === 'AbortError') return;
          setOpen(true);
        });
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <button className="share-bar" type="button" aria-label="공유하기" onClick={onShare}>
        공유하기
      </button>
      {open ? (
        <ShareSheet
          slug={service.slug}
          title={service.title}
          text={text}
          kind={kind}
          onClose={() => setOpen(false)}
          linkFor={(medium) => shareLink(service.slug, medium, undefined, kind)}
        />
      ) : null}
    </>
  );
}
