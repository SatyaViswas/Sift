import { useState, useRef, useEffect } from 'react';
import { useNavigation } from '../../context/NavigationContext';
import { useAuth } from '../../context/AuthContext';
import ThemeToggle from '../ThemeToggle/ThemeToggle';
import './AppHeader.css';

/**
 * AppHeader — Mobile-only top bar with Sift wordmark, theme toggle, and profile button.
 * Hidden on desktop (≥ 768px) — SidebarNav takes over.
 */
export default function AppHeader() {
  const { activeTab } = useNavigation();
  const { user, signOut } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const menuRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileOpen]);

  const avatarInitial = user?.email ? user.email[0].toUpperCase() : '?';

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

          {/* Profile avatar button */}
          <div className="app-header__profile-wrap" ref={menuRef}>
            <button
              id="app-header-profile-btn"
              className="app-header__avatar-btn"
              onClick={() => setProfileOpen(prev => !prev)}
              aria-expanded={profileOpen}
              aria-haspopup="menu"
              aria-label="Account menu"
            >
              {avatarInitial}
            </button>

            {profileOpen && (
              <div className="app-header__profile-menu" role="menu" aria-label="Account options">
                <div className="app-header__profile-email">{user?.email}</div>
                <div className="app-header__profile-menu-divider" />
                <button
                  id="app-header-signout-btn"
                  className="app-header__profile-menu-item app-header__profile-menu-item--danger"
                  role="menuitem"
                  onClick={() => { setProfileOpen(false); signOut(); }}
                >
                  <svg viewBox="0 0 24 24" fill="none" width="14" height="14" aria-hidden="true">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <polyline points="16 17 21 12 16 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="21" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Subtle section indicator line at bottom of header */}
      <div className="app-header__accent-line" aria-hidden="true" />
    </header>
  );
}
