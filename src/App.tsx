import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { GameProvider } from './engine/GameContext';
import LandingPage from './components/LandingPage';
import AuthCallback from './components/AuthCallback';
import Dashboard from './components/Dashboard';
import GameSetup from './components/GameSetup';
import ScoringScreen from './components/ScoringScreen';
import MatchSummary from './components/MatchSummary';
import MatchHistory from './components/MatchHistory';

/**
 * Protected route wrapper — redirects to landing if not authenticated or guest
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isGuest, loading } = useAuth();

  if (loading) {
    return (
      <div className="page page-centered">
        <div className="spinner" />
      </div>
    );
  }

  if (!user && !isGuest) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

/**
 * Public route — redirects to dashboard if already authenticated
 */
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isGuest, loading } = useAuth();

  if (loading) {
    return (
      <div className="page page-centered">
        <div className="spinner" />
      </div>
    );
  }

  if (user || isGuest) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/"
        element={
          <PublicRoute>
            <LandingPage />
          </PublicRoute>
        }
      />
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* Protected routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/setup"
        element={
          <ProtectedRoute>
            <GameSetup />
          </ProtectedRoute>
        }
      />
      <Route
        path="/play"
        element={
          <ProtectedRoute>
            <GameProvider>
              <ScoringScreen />
            </GameProvider>
          </ProtectedRoute>
        }
      />
      <Route
        path="/summary"
        element={
          <ProtectedRoute>
            <MatchSummary />
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <MatchHistory />
          </ProtectedRoute>
        }
      />

      {/* Catch-all redirect */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
