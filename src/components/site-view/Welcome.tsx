'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useSiteView, WELCOME_EVENT, type SiteView } from './SiteViewProvider';
import { SV_KEY, SV_NAME, Mark } from './config';

/* THE WELCOME. One question, one explanation, one small labelled illustration, two equal
 * choices. It opens by itself on `/` unless the reader turned it off or the URL carries
 * welcome=0, and the footer's Start here always reopens it. The words and the illustration are
 * this product's own and arrive as props from the server layout, so no data module rides down to the browser. */
const OFF_KEY = `${SV_KEY}:welcome-off`;

export type WelcomeCopy = { intro: ReactNode; illustration: ReactNode; consoleLine: string };

export default function Welcome({ intro, illustration, consoleLine }: WelcomeCopy) {
  const mode = useSiteView();
  const path = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previous = useRef<HTMLElement | null>(null);
  const [off, setOff] = useState(false);
  const [visible, setVisible] = useState(false);

  const show = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    const d = dialog.current;
    if (d && !d.open) {
      previous.current = document.activeElement as HTMLElement | null;
      d.showModal();
    }
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    if (timer.current) clearTimeout(timer.current);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    timer.current = setTimeout(() => {
      dialog.current?.close();
      const back = previous.current;
      if (back && back.isConnected && back !== document.body) back.focus({ preventScroll: true });
      else document.querySelector<HTMLElement>('#start input, #start button, .sv-brand, a[href="/"]')?.focus({ preventScroll: true });
    }, reduced ? 0 : 220);
  }, []);

  useEffect(() => {
    let disabled = false;
    try { disabled = localStorage.getItem(OFF_KEY) === '1'; } catch {}
    setOff(disabled);
    if (path === '/' && !disabled && new URLSearchParams(window.location.search).get('welcome') !== '0') show();
    window.addEventListener(WELCOME_EVENT, show);
    return () => {
      window.removeEventListener(WELCOME_EVENT, show);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [path, show]);

  function select(view: SiteView) {
    mode?.choose(view);
    close();
  }

  return (
    <dialog
      ref={dialog}
      className="sv-welcome"
      data-visible={visible}
      aria-labelledby="sv-welcome-title"
      onCancel={(e) => { e.preventDefault(); close(); }}
      onClick={(e) => { if (e.target === dialog.current) close(); }}
    >
      <header className="sv-welcome-top">
        <span className="sv-brand-static">
          <Mark size={22} />
          {SV_NAME}
          <small>/ START HERE</small>
        </span>
        <button type="button" className="sv-close" aria-label="Close welcome" onClick={close} autoFocus>
          {'×'}
        </button>
      </header>

      <div className="sv-welcome-intro">
        {intro}
      </div>

      <section className="sv-illustration" aria-label="Illustration">
        {illustration}
      </section>

      <section className="sv-welcome-choose">
        <div className="sv-welcome-choose-head">
          <h3>How would you like to explore?</h3>
          <p>You can switch anytime.</p>
        </div>
        <div className="sv-choices">
          <button type="button" onClick={() => select('console')}>
            <b>Console</b>
            <strong>See more at once.</strong>
            <span>{consoleLine}</span>
          </button>
          <button type="button" onClick={() => select('simple')}>
            <b>Simple</b>
            <strong>Start with the essentials.</strong>
            <span>A roomier overview with details you can open as you go.</span>
          </button>
        </div>
      </section>

      <footer className="sv-welcome-foot">
        <label>
          <input
            type="checkbox"
            checked={off}
            onChange={(e) => {
              const value = e.target.checked;
              setOff(value);
              try {
                if (value) localStorage.setItem(OFF_KEY, '1');
                else localStorage.removeItem(OFF_KEY);
              } catch {}
            }}
          />
          Don&apos;t open this when I come back
        </label>
      </footer>
    </dialog>
  );
}
