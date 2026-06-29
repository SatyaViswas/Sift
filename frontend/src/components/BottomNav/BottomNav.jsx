import { useNavigation } from '../../context/NavigationContext';
import './BottomNav.css';

const TABS = [
  {
    id: 'slate',
    label: 'The Slate',
    shortLabel: 'Slate',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect
          x="4" y="3" width="16" height="18" rx="2.5"
          stroke="currentColor"
          strokeWidth={active ? "1.8" : "1.5"}
          fill={active ? "currentColor" : "none"}
          fillOpacity={active ? "0.08" : "0"}
        />
        <line x1="8" y1="8"  x2="16" y2="8"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="8" y1="16" x2="12" y2="16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'oracle',
    label: 'The Oracle',
    shortLabel: 'Oracle',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle
          cx="12" cy="12" r="8"
          stroke="currentColor"
          strokeWidth={active ? "1.8" : "1.5"}
          fill={active ? "currentColor" : "none"}
          fillOpacity={active ? "0.08" : "0"}
        />
        <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="M7.5 19c.8-2.1 2.5-3.5 4.5-3.5s3.7 1.4 4.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'blindspots',
    label: 'Blindspots',
    shortLabel: 'Insights',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path
          d="M3 18l4-7 4 4 4-8 4 4"
          stroke="currentColor"
          strokeWidth={active ? "1.8" : "1.5"}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="7"  cy="11" r="1.5" fill="currentColor" fillOpacity={active ? "1" : "0.5"} />
        <circle cx="11" cy="15" r="1.5" fill="currentColor" fillOpacity={active ? "1" : "0.5"} />
        <circle cx="15" cy="7"  r="1.5" fill="currentColor" fillOpacity={active ? "1" : "0.5"} />
        <circle cx="19" cy="11" r="1.5" fill="currentColor" fillOpacity={active ? "1" : "0.5"} />
      </svg>
    ),
  },
];

/**
 * BottomNav — Tactile 3-tab navigation bar.
 * Anchored to bottom of mobile viewport / chassis.
 */
export default function BottomNav() {
  const { activeTab, navigate } = useNavigation();

  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      <div className="bottom-nav__inner">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`nav-${tab.id}`}
              className={`bottom-nav__tab ${isActive ? 'bottom-nav__tab--active' : ''}`}
              onClick={() => navigate(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={tab.label}
              data-tab={tab.id}
            >
              <span className="bottom-nav__icon">
                {tab.icon(isActive)}
              </span>
              <span className="bottom-nav__label">{tab.shortLabel}</span>
              {isActive && <span className="bottom-nav__pip" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
