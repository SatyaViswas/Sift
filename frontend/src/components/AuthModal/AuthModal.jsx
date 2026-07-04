import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import './AuthModal.css';

/**
 * AuthModal — Glassmorphism modal for Email + Google auth.
 * mode: 'login' | 'signup'
 */
export default function AuthModal({ onClose }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const clearState = () => {
    setError(null);
    setSuccessMsg(null);
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);
    clearState();

    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        setSuccessMsg('Account created! Check your email to confirm, then log in.');
        setMode('login');
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        // AuthContext will detect the session change automatically — no need to call onClose
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    clearState();
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      setError(err.message || 'Google sign-in failed.');
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-overlay" role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="auth-modal" role="dialog" aria-modal="true" aria-label="Sign in to Sift">
        {/* Header */}
        <div className="auth-modal__header">
          <div className="auth-modal__logo">
            <span className="auth-modal__logo-text">Sift</span>
            <span className="auth-modal__logo-dot" aria-hidden="true" />
          </div>
          <button className="auth-modal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Tab Switcher */}
        <div className="auth-modal__tabs" role="tablist">
          <button
            role="tab"
            aria-selected={mode === 'login'}
            className={`auth-modal__tab ${mode === 'login' ? 'auth-modal__tab--active' : ''}`}
            onClick={() => { setMode('login'); clearState(); }}
          >
            Log In
          </button>
          <button
            role="tab"
            aria-selected={mode === 'signup'}
            className={`auth-modal__tab ${mode === 'signup' ? 'auth-modal__tab--active' : ''}`}
            onClick={() => { setMode('signup'); clearState(); }}
          >
            Sign Up
          </button>
        </div>

        {/* Form */}
        <form className="auth-modal__form" onSubmit={handleEmailAuth} noValidate>
          <div className="auth-modal__field">
            <label className="auth-modal__label" htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              className="auth-modal__input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              autoComplete="email"
              autoFocus
            />
          </div>
          <div className="auth-modal__field">
            <label className="auth-modal__label" htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              className="auth-modal__input"
              placeholder={mode === 'signup' ? 'Min. 6 characters' : '••••••••'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
          </div>

          {error && (
            <div className="auth-modal__error" role="alert" aria-live="assertive">
              <svg viewBox="0 0 24 24" fill="none" width="15" height="15" aria-hidden="true">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
                <line x1="12" y1="8" x2="12" y2="12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="12" cy="15.5" r="0.9" fill="currentColor" />
              </svg>
              {error}
            </div>
          )}
          {successMsg && (
            <div className="auth-modal__success" role="status" aria-live="polite">
              ✓ {successMsg}
            </div>
          )}

          <button
            id="auth-email-submit-btn"
            type="submit"
            className={`auth-modal__btn-primary ${isLoading ? 'auth-modal__btn-primary--loading' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="auth-modal__spinner" aria-label="Loading…" />
            ) : (
              mode === 'login' ? 'Log In' : 'Create Account'
            )}
          </button>
        </form>

        {/* Divider */}
        <div className="auth-modal__divider">
          <span className="auth-modal__divider-line" aria-hidden="true" />
          <span className="auth-modal__divider-text">or</span>
          <span className="auth-modal__divider-line" aria-hidden="true" />
        </div>

        {/* Google OAuth */}
        <button
          id="auth-google-btn"
          className="auth-modal__btn-google"
          onClick={handleGoogleAuth}
          disabled={isLoading}
          type="button"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Continue with Google
        </button>

        <p className="auth-modal__footer-note">
          By continuing, you agree that your journal entries are private and encrypted per your account.
        </p>
      </div>
    </div>
  );
}
