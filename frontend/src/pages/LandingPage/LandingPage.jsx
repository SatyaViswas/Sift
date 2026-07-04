import { useState, useEffect } from 'react';
import AuthModal from '../../components/AuthModal/AuthModal';
import './LandingPage.css';

const FEATURES = [
  {
    id: 'slate',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="4" y="3" width="16" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
        <line x1="8" y1="8" x2="16" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="8" y1="16" x2="12" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    color: 'amber',
    title: 'The Slate',
    desc: 'A private diary that understands you — voice or text, snippets or deep reflections.',
  },
  {
    id: 'oracle',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7.5 19c.8-2.1 2.5-3.5 4.5-3.5s3.7 1.4 4.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    color: 'sage',
    title: 'The Oracle',
    desc: 'Ask anything about your past. The Oracle searches your cognitive graph to surface exact memories.',
  },
  {
    id: 'blindspots',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 18l4-7 4 4 4-8 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="7" cy="11" r="1.5" fill="currentColor" />
        <circle cx="11" cy="15" r="1.5" fill="currentColor" />
        <circle cx="15" cy="7" r="1.5" fill="currentColor" />
        <circle cx="19" cy="11" r="1.5" fill="currentColor" />
      </svg>
    ),
    color: 'rose',
    title: 'Blindspots',
    desc: 'Discover hidden cause-and-effect loops in your life patterns across months and years.',
  },
];

export default function LandingPage() {
  const [showAuth, setShowAuth] = useState(false);

  // Read and sync theme with existing ThemeContext storage (before ThemeProvider mounts)
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem('sift-theme');
      if (stored === 'light' || stored === 'dark') return stored;
    } catch (_) {}
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // Keep html[data-theme] in sync so CSS vars work
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('sift-theme', theme); } catch (_) {}
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light');

  return (
    <div className="landing">
      {/* ── Animated Background ── */}
      <div className="landing__bg" aria-hidden="true">
        <div className="landing__bg-orb landing__bg-orb--1" />
        <div className="landing__bg-orb landing__bg-orb--2" />
        <div className="landing__bg-orb landing__bg-orb--3" />
        <div className="landing__bg-grid" />
        <div className="landing__bg-noise" />
      </div>

      {/* ── Navigation Bar ── */}
      <nav className="landing__nav">
          <div className="landing__nav-inner">
          <div className="landing__nav-brand">
            <span className="landing__nav-wordmark">Sift</span>
            <span className="landing__nav-dot" aria-hidden="true" />
          </div>
          <div className="landing__nav-actions">
            <button
              id="landing-theme-toggle"
              className="landing__nav-theme-btn"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? (
                <svg viewBox="0 0 24 24" fill="none" width="17" height="17" aria-hidden="true">
                  <circle cx="12" cy="12" r="5" stroke="currentColor" strokeWidth="1.8"/>
                  <line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  <line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  <line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  <line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" width="17" height="17" aria-hidden="true">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
            <button
              id="landing-nav-signin-btn"
              className="landing__nav-signin"
              onClick={() => setShowAuth(true)}
            >
              Sign In
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <main className="landing__hero">
        {/* Eyebrow badge */}
        <div className="landing__eyebrow">
          <span className="landing__eyebrow-dot" aria-hidden="true" />
          Cognitive Recovery Journal
        </div>

        {/* Headline */}
        <h1 className="landing__headline">
          Remember<br />
          <span className="landing__headline-gradient">who you are.</span>
        </h1>

        {/* Sub-copy */}
        <p className="landing__subheadline">
          Your memories, habits, and patterns — unified in a living knowledge graph
          that grows smarter the more you journal. Private, personal, powerful.
        </p>

        {/* CTA buttons */}
        <div className="landing__cta-group">
          <button
            id="landing-cta-primary"
            className="landing__cta-primary"
            onClick={() => setShowAuth(true)}
          >
            <span>Start Journaling Free</span>
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <p className="landing__cta-note">No credit card · Your data is always private</p>
        </div>

        {/* Feature chips */}
        <div className="landing__features">
          {FEATURES.map((f) => (
            <div key={f.id} className={`landing__feature landing__feature--${f.color}`}>
              <div className="landing__feature-icon">{f.icon}</div>
              <div className="landing__feature-body">
                <p className="landing__feature-title">{f.title}</p>
                <p className="landing__feature-desc">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Stats row */}
        <div className="landing__stats">
          <div className="landing__stat">
            <span className="landing__stat-value">AI-powered</span>
            <span className="landing__stat-label">memory graph</span>
          </div>
          <div className="landing__stat-sep" aria-hidden="true" />
          <div className="landing__stat">
            <span className="landing__stat-value">100% private</span>
            <span className="landing__stat-label">encrypted vault</span>
          </div>
          <div className="landing__stat-sep" aria-hidden="true" />
          <div className="landing__stat">
            <span className="landing__stat-value">Voice & text</span>
            <span className="landing__stat-label">capture modes</span>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="landing__footer">
        <p>Built with Cognee AI · Your memories never leave your vault</p>
      </footer>

      {/* ── Auth Modal ── */}
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}
