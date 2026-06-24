import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

export default function LandingPage() {
  const { user, isGuest, loading, signInWithGoogle, startGuestSession } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (!loading && (user || isGuest)) {
      navigate('/dashboard');
    }
  }, [user, isGuest, loading, navigate]);

  if (loading) {
    return (
      <div className="page page-centered">
        <div className="spinner" />
      </div>
    );
  }

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Sign-in error:', err);
    }
  };

  return (
    <div className="landing-page">
      <button onClick={toggleTheme} className="theme-toggle-floating" aria-label="Toggle theme">
        {theme === 'dark' ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        )}
      </button>
      <div className="landing-content">
        <div className="landing-logo">
          <div className="landing-logo-icon">🐝</div>
        </div>
        <h1 className="landing-title">SnookerBee</h1>
        <p className="landing-subtitle">Snooker Score Tracker</p>

        <div className="landing-actions">
          <button onClick={handleSignIn} className="btn btn-google btn-lg">
            <svg
              className="google-icon"
              viewBox="0 0 24 24"
              width="24"
              height="24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                fill="#EA4335"
              />
            </svg>
            Sign in with Google
          </button>

          <div className="landing-divider">
            <span>or</span>
          </div>

          <button onClick={startGuestSession} className="btn btn-secondary btn-lg">
            Play as Guest
          </button>
        </div>

        <div className="landing-balls">
          <div className="landing-ball ball-red" style={{ '--delay': '0.1s' } as React.CSSProperties} />
          <div className="landing-ball ball-yellow" style={{ '--delay': '0.2s' } as React.CSSProperties} />
          <div className="landing-ball ball-green" style={{ '--delay': '0.3s' } as React.CSSProperties} />
          <div className="landing-ball ball-brown" style={{ '--delay': '0.4s' } as React.CSSProperties} />
          <div className="landing-ball ball-blue" style={{ '--delay': '0.5s' } as React.CSSProperties} />
          <div className="landing-ball ball-pink" style={{ '--delay': '0.6s' } as React.CSSProperties} />
          <div className="landing-ball ball-black" style={{ '--delay': '0.7s' } as React.CSSProperties} />
        </div>
      </div>
    </div>
  );
}
