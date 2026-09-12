import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { setupApi } from './api/setup';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { AdminLogin } from './pages/AdminLogin';
import { AdminPanel } from './pages/AdminPanel';
import { Login } from './pages/Login';
import { MainChat } from './pages/MainChat';
import { QrConfirm } from './pages/QrConfirm';
import { Register } from './pages/Register';
import { SetupWizard } from './pages/SetupWizard';
import { ShareJoin } from './pages/ShareJoin';
import { Settings } from './pages/Settings';
import { Spinner } from './components/Spinner';
import { ThemeProvider } from './context/ThemeContext';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="full-loading">
        <Spinner size={28} />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

function RequireGuest({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="full-loading">
        <Spinner size={28} />
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;
  return children;
}

function RequireAdmin({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="full-loading">
        <Spinner size={28} />
      </div>
    );
  }
  if (!user) return <Navigate to="/admin/login" replace />;
  if (!user.isAdmin) return <Navigate to="/" replace />;
  return children;
}

function SetupGate({ children }: { children: JSX.Element }) {
  const [status, setStatus] = useState<{ initialized: boolean | null }>({ initialized: null });
  const location = useLocation();
  const isSetupRoute = location.pathname.startsWith('/setup');

  useEffect(() => {
    (async () => {
      try {
        const s = await setupApi.status();
        setStatus({ initialized: s.initialized });
      } catch {
        // If backend unreachable, assume not initialized so the wizard can show.
        setStatus({ initialized: false });
      }
    })();
  }, [location.pathname]);

  if (status.initialized === null) {
    return (
      <div className="full-loading">
        <Spinner size={28} />
      </div>
    );
  }

  if (!status.initialized && !isSetupRoute) {
    return <Navigate to="/setup" replace />;
  }
  if (status.initialized && isSetupRoute) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/setup" element={<SetupGate><SetupWizard /></SetupGate>} />
      <Route path="/login" element={<SetupGate><RequireGuest><Login /></RequireGuest></SetupGate>} />
      <Route path="/register" element={<SetupGate><RequireGuest><Register /></RequireGuest></SetupGate>} />
      <Route path="/share/:token" element={<SetupGate><ShareJoin /></SetupGate>} />
      <Route path="/qr-confirm" element={<SetupGate><QrConfirm /></SetupGate>} />
      <Route
        path="/settings"
        element={
          <SetupGate>
            <RequireAuth>
              <Settings />
            </RequireAuth>
          </SetupGate>
        }
      />
      <Route path="/admin/login" element={<SetupGate><RequireGuest><AdminLogin /></RequireGuest></SetupGate>} />
      <Route
        path="/admin"
        element={
          <SetupGate>
            <RequireAdmin>
              <AdminPanel />
            </RequireAdmin>
          </SetupGate>
        }
      />
      <Route
        path="/"
        element={
          <SetupGate>
            <RequireAuth>
              <MainChat />
            </RequireAuth>
          </SetupGate>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <ThemeProvider>
            <AppRoutes />
          </ThemeProvider>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
