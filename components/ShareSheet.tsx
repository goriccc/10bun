'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { serviceBySlug } from '@/content/services';
import { track } from '@/lib/analytics';
import { dateShort, shareLink, type ShareMedium } from '@/lib/share';

export function ShareSheet({
  slug,
  title,
  text,
  onClose,
  linkFor,
  kind = 'invite',
}: {
  slug: string;
  title: string;
  text: string;
  onClose: () => void;
  linkFor?: (medium: ShareMedium) => string;
  kind?: 'invite' | 'result';
}) {
  const titleId = useId();
  const first = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [toast, setToast] = useState('');
  const [fallback, setFallback] = useState('');
  const [hasShare, setHasShare] = useState(false);
  const menuTitle = serviceBySlug(slug)?.title ?? title;
  const heading = `10분닷컴 - ${menuTitle}`;
  const dateLine = title.trim() && title.trim() !== menuTitle ? title.trim() : dateShort();
  const link = (medium: ShareMedium) => (linkFor ? linkFor(medium) : shareLink(slug, medium, undefined, kind));
  const body = `${text}\n${link('text')}`;

  useEffect(() => {
    track('share_open', { game: slug, kind });
    setHasShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
    first.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [kind, onClose, slug]);

  useEffect(() => {
    const node = headingRef.current;
    if (!node) return;
    const fit = () => {
      const max = 26;
      const min = 14;
      let size = max;
      node.style.fontSize = `${size}px`;
      while (size > min && node.scrollWidth > node.clientWidth) {
        size -= 0.5;
        node.style.fontSize = `${size}px`;
      }
    };
    fit();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    observer?.observe(node);
    window.addEventListener('resize', fit);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [heading]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 1800);
  };

  const copy = async (value: string, message: string, medium: ShareMedium) => {
    try {
      await navigator.clipboard.writeText(value);
      track('share_copy', { game: slug, kind, medium });
      showToast(message);
    } catch {
      setFallback(value);
      showToast('길게 눌러 복사하세요');
    }
  };

  return (
    <div className="modal" role="presentation" onClick={onClose}>
      <div className="ticket" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(event) => event.stopPropagation()}>
        <div className="ticket-top">
          <h3 id={titleId} ref={headingRef} className="ticket-heading">
            {heading}
          </h3>
          <p className="ticket-date">{dateLine}</p>
        </div>
        <div className="ticket-body">
          <pre className="share-preview">{text}</pre>
          {fallback ? <textarea className="share-fallback" readOnly value={fallback} rows={4} /> : null}
          <div className="share-actions">
            {hasShare ? (
              <button
                ref={first}
                className="btn sm"
                type="button"
                onClick={() => {
                  void navigator
                    .share({ title: heading, text, url: link('native') })
                    .then(() => {
                      track('share_native', { game: slug, kind });
                      onClose();
                    })
                    .catch((err: unknown) => {
                      if (err && typeof err === 'object' && 'name' in err && (err as { name?: string }).name === 'AbortError') {
                        onClose();
                        return;
                      }
                      void copy(body, '복사했어요. 단톡방에 붙여 넣으세요', 'text');
                    });
                }}
              >
                공유하기
              </button>
            ) : null}
            <button
              ref={hasShare ? undefined : first}
              className="btn sm"
              type="button"
              onClick={() => void copy(link('copy'), '링크를 복사했어요', 'copy')}
            >
              링크 복사
            </button>
            <button className="btn sm ghost" type="button" onClick={() => void copy(body, '복사했어요. 단톡방에 붙여 넣으세요', 'text')}>
              문구와 링크 복사
            </button>
            {!hasShare ? (
              <>
                <a
                  className="btn sm ghost"
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link('x'))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => track('share_x', { game: slug, kind })}
                >
                  X
                </a>
                <a
                  className="btn sm ghost"
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link('facebook'))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => track('share_facebook', { game: slug, kind })}
                >
                  페이스북
                </a>
              </>
            ) : null}
          </div>
          <div className="share-close">
            <button className="btn sm ghost" type="button" onClick={onClose}>
              닫기
            </button>
          </div>
        </div>
      </div>
      {toast ? <div className="toast show">{toast}</div> : null}
    </div>
  );
}
