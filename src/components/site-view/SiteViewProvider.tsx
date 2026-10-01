'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Welcome, { type WelcomeCopy } from './Welcome';
import { SV_KEY } from './config';
import './sv-tokens.css';
import './simple.css';

/* THE VIEW AUTHORITY. Console is the default for a clean visitor. A valid ?view= wins over the
 * saved choice, and a valid explicit choice is saved. Every storage access is wrapped, because a
 * private window can throw on read. */
export type SiteView = 'console' | 'simple';
type Mode = { view: SiteView; choose: (view: SiteView) => void; welcome: () => void };

const Context = createContext<Mode | null>(null);
export function useSiteView() {
  return useContext(Context);
}

const VIEW_KEY = `${SV_KEY}:view`;
export const WELCOME_EVENT = `${SV_KEY}:welcome`;

/* DRAFTS LIVE IN MEMORY, above both views, so a value typed in one view is still there after a
 * switch or a route change. They are never written to storage. Outside the provider the hook
 * falls back to local state. */
type Drafts = { drafts: Record<string, unknown>; set: (key: string, value: unknown) => void };
const DraftContext = createContext<Drafts | null>(null);
export function useDraft<T>(key: string, initial: T): [T, (value: T) => void] {
  const ctx = useContext(DraftContext);
  const [local, setLocal] = useState<T>(initial);
  const shared = ctx?.set;
  const set = useCallback((v: T) => (shared ? shared(key, v) : setLocal(v)), [shared, key]);
  if (!ctx) return [local, set];
  return [(key in ctx.drafts ? ctx.drafts[key] : initial) as T, set];
}

export default function SiteViewProvider({ children, welcome: copy }: { children: ReactNode; welcome: WelcomeCopy }) {
  const [view, setView] = useState<SiteView>('console');
  const path = usePathname();

  const choose = useCallback((next: SiteView) => {
    setView(next);
    try { localStorage.setItem(VIEW_KEY, next); } catch {}
    const url = new URL(window.location.href);
    if (url.searchParams.has('view')) {
      url.searchParams.set('view', next);
      window.history.replaceState(window.history.state, '', url.href);
    }
  }, []);

  useEffect(() => {
    const explicit = new URLSearchParams(window.location.search).get('view');
    if (explicit === 'simple' || explicit === 'console') {
      choose(explicit);
      return;
    }
    let saved: string | null = null;
    try { saved = localStorage.getItem(VIEW_KEY); } catch {}
    setView(saved === 'simple' ? 'simple' : 'console');
  }, [path, choose]);

  const welcome = useCallback(() => window.dispatchEvent(new Event(WELCOME_EVENT)), []);
  const [drafts, setDrafts] = useState<Record<string, unknown>>({});
  const setDraft = useCallback((key: string, value: unknown) => setDrafts((d) => ({ ...d, [key]: value })), []);
  const draftValue = useMemo(() => ({ drafts, set: setDraft }), [drafts, setDraft]);

  return (
    <Context.Provider value={{ view, choose, welcome }}>
      <DraftContext.Provider value={draftValue}>
        <div className="sv-surface" data-view={view}>{children}</div>
      </DraftContext.Provider>
      <Welcome {...copy} />
    </Context.Provider>
  );
}
