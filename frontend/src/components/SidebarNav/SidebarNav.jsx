import { useNavigation } from '../../context/NavigationContext';
import { useTheme } from '../../context/ThemeContext';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
import './SidebarNav.css';

const TABS = [
  {
    id: 'slate',
    label: 'The Slate',
    description: 'Daily journal',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="4" y="3" width="16" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
        <line x1="8" y1="8"  x2="16" y2="8"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="8" y1="16" x2="12" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'oracle',
    label: 'The Oracle',
    description: 'Cognitive recovery',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7.5 19c.8-2.1 2.5-3.5 4.5-3.5s3.7 1.4 4.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'blindspots',
    label: 'Blindspots',
    description: 'Pattern insights',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M3 18l4-7 4 4 4-8 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="7"  cy="11" r="1.5" fill="currentColor" />
        <circle cx="11" cy="15" r="1.5" fill="currentColor" />
        <circle cx="15" cy="7"  r="1.5" fill="currentColor" />
        <circle cx="19" cy="11" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: 'history',
    label: 'The Archives',
    description: 'Past entries & patterns',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="4" y="6" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 4V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M16 4V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M4 10H20" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
];

/**
 * SidebarNav — Desktop-only left sidebar navigation.
 * Hidden on mobile via CSS (display: none on < 768px).
 */
export default function SidebarNav() {
  const { activeTab, navigate } = useNavigation();
  const { theme } = useTheme();

  return (
    <aside className="sidebar" aria-label="Application navigation">
      {/* ── Wordmark ── */}
      <div className="sidebar__brand">
        <div className="sidebar__logo">
          <span className="sidebar__logo-text">Sift</span>
          <span className={`sidebar__logo-dot sidebar__logo-dot--${activeTab}`} aria-hidden="true" />
        </div>
        <p className="sidebar__tagline">Cognitive Recovery Journal</p>
      </div>

      {/* ── Divider ── */}
      <div className="sidebar__divider" aria-hidden="true" />

      {/* ── Navigation ── */}
      <nav className="sidebar__nav" aria-label="Main navigation">
        <p className="sidebar__nav-label">Workspaces</p>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`sidebar-nav-${tab.id}`}
              className={`sidebar__nav-item sidebar__nav-item--${tab.id} ${isActive ? 'sidebar__nav-item--active' : ''}`}
              onClick={() => navigate(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={tab.label}
            >
              <span className="sidebar__nav-icon">{tab.icon}</span>
              <span className="sidebar__nav-text">
                <span className="sidebar__nav-title">{tab.label}</span>
                <span className="sidebar__nav-desc">{tab.description}</span>
              </span>
              {isActive && <span className="sidebar__nav-pip" aria-hidden="true" />}
            </button>
          );
        })}
      </nav>

      {/* ── Spacer ── */}
      <div className="sidebar__spacer" />

      {/* ── Bottom Controls ── */}
      <div className="sidebar__footer">
        <div className="sidebar__divider" aria-hidden="true" />
        <div className="sidebar__footer-inner">
          <div className="sidebar__footer-info">
            <span className="sidebar__footer-label">Appearance</span>
            <span className="sidebar__footer-value">
              {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
            </span>
          </div>
          <ThemeToggle />
        </div>

        <div className="sidebar__system-status">
          <span className="sidebar__status-dot" aria-hidden="true" />
          <span className="sidebar__status-text">Backend connected</span>
        </div>
      </div>
    </aside>
  );
}
