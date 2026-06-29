import { useNavigation } from '../../context/NavigationContext';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
import './AppHeader.css';

/**
 * AppHeader — Persistent top bar with Sift wordmark and theme toggle.
 * Anchored within the chassis / mobile viewport.
 */
export default function AppHeader() {
  const { activeTab } = useNavigation();

  return (
    <header className={`app-header app-header--${activeTab}`}>
      <div className="app-header__inner">
        {/* Wordmark */}
        <div className="app-header__wordmark" aria-label="Sift">
          <span className="app-header__logo-text">Sift</span>
          <span className="app-header__logo-dot" aria-hidden="true" />
        </div>

        {/* Right controls */}
        <div className="app-header__controls">
          <ThemeToggle />
        </div>
      </div>

      {/* Subtle section indicator line at bottom of header */}
      <div className="app-header__accent-line" aria-hidden="true" />
    </header>
  );
}
