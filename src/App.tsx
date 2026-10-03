import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { SettingsProvider } from './hooks/useSettings';
import { GameProvider } from './engine/GameContext';
import { ToastProvider, LayoutDebug } from './components/ui';
import LandingPage from './components/LandingPage';
import OrientationWarning from './components/OrientationWarning';
import AuthCallback from './components/AuthCallback';
import Dashboard from './components/Dashboard';
import GameSetup from './components/GameSetup';
import ScoringScreen from './components/ScoringScreen';
import CenturyScreen from './components/CenturyScreen';
import MatchSummary from './components/MatchSummary';
import MatchHistory from './components/MatchHistory';
import UIDemo from './components/dev/UIDemo';
import PlayerStats from './components/PlayerStats';
import PlayedTogether from './components/PlayedTogether';
import MatchPage from './components/MatchPage';
import ShareSheet from './components/ShareSheet';
import Settings from './components/Settings';
import WhatsNew from './components/WhatsNew';

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

      {/* Phase 1 design-system demo (not linked from the app) */}
      <Route path="/ui" element={<UIDemo />} />

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
        path="/century"
        element={
          <ProtectedRoute>
            <CenturyScreen />
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

      <Route
        path="/stats"
        element={
          <ProtectedRoute>
            <PlayerStats />
          </ProtectedRoute>
        }
      />
      <Route
        path="/players"
        element={
          <ProtectedRoute>
            <PlayerStats />
          </ProtectedRoute>
        }
      />
      <Route
        path="/together"
        element={
          <ProtectedRoute>
            <PlayedTogether />
          </ProtectedRoute>
        }
      />
      <Route
        path="/match/:id"
        element={
          <ProtectedRoute>
            <MatchPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />

      <Route
        path="/whats-new"
        element={
          <ProtectedRoute>
            <WhatsNew />
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
      <ToastProvider>
        <AuthProvider>
          <SettingsProvider>
            <AppRoutes />
            <ShareSheet />
          </SettingsProvider>
        </AuthProvider>
        <OrientationWarning />
        <LayoutDebug />
      </ToastProvider>
    </BrowserRouter>
  );
}
