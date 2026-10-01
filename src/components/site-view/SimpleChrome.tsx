'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SV_NAME, Mark } from './config';
import ViewControls from './ViewControls';

const REPO = 'https://github.com/kyisaiah47/compound-evals';
const NAV = [
  { href: '/#start', label: 'Pick an environment' },
  { href: '/environments', label: 'Every environment' },
  { href: '/#how', label: 'How a score is made' },
];

export function SimpleHeader() {
  const path = usePathname();
  return (
    <header className="sv-nav">
      <div className="sv-in">
        <Link className="sv-brand" href="/">
          <Mark size={24} />
          {SV_NAME}
        </Link>
        <nav aria-label="Main navigation">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={path === n.href ? 'page' : undefined}>{n.label}</Link>
          ))}
          <a href={REPO} rel="noreferrer">Source <span aria-hidden="true">{'↗'}</span></a>
        </nav>
      </div>
    </header>
  );
}

export function SimpleFooter() {
  return (
    <footer className="sv-footer">
      <div className="sv-in">
        <div className="sv-footer-main">
          <nav aria-label="Footer">
            <Link href="/">Scorecard</Link>
            <Link href="/environments">Every environment</Link>
            <a href={REPO} rel="noreferrer">Source on GitHub</a>
            <a href="https://thecompound.tech" rel="noreferrer">Compound Labs</a>
          </nav>
          <div className="sv-footer-credit"><span>Every score carries the environment that produced it.</span></div>
        </div>
        <ViewControls />
      </div>
    </footer>
  );
}
