import { useTheme } from '../../context/ThemeContext';
import './ThemeToggle.css';

/**
 * ThemeToggle — Animated sun/moon icon switcher for the app header.
 */
export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      className={`theme-toggle ${isDark ? 'theme-toggle--dark' : 'theme-toggle--light'}`}
      onClick={toggle}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      <span className="theme-toggle__track" aria-hidden="true">
        {/* Sun rays */}
        <svg
          className="theme-toggle__sun"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.5" />
          <line x1="12" y1="2" x2="12" y2="5"   stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="2"  y1="12" x2="5"  y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="19" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="4.22" y1="4.22" x2="6.34" y2="6.34"   stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="4.22" y1="19.78" x2="6.34" y2="17.66"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="17.66" y1="6.34" x2="19.78" y2="4.22"  stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>

        {/* Moon */}
        <svg
          className="theme-toggle__moon"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </button>
  );
}
