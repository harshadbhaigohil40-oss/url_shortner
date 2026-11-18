import React, { lazy, Suspense, useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ToastProvider } from './components/Toast';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import PageLoader from './components/PageLoader';
import ScrollProgress from './components/ScrollProgress';
import ErrorBoundary from './components/ErrorBoundary';
import SkipLink from './components/SkipLink';

// Lazy load route pages for bundle size optimization
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const Unlock = lazy(() => import('./pages/Unlock'));
const BioView = lazy(() => import('./pages/BioView'));


const SimpleLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background text-on-surface">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      <p className="text-sm font-medium text-text-muted tracking-wide">Loading...</p>
    </div>
  </div>
);

// Route-level error boundaries for graceful degradation
const HomeWithBoundary = () => (
  <ErrorBoundary fallback={<div className="min-h-screen flex items-center justify-center p-4"><div className="text-center"><h2 className="text-xl font-semibold mb-2">Unable to load homepage</h2><p className="text-text-muted">Please refresh the page or try again later.</p></div></div>}>
    <Home />
  </ErrorBoundary>
);

const DashboardWithBoundary = () => (
  <ErrorBoundary fallback={<div className="min-h-screen flex items-center justify-center p-4"><div className="text-center"><h2 className="text-xl font-semibold mb-2">Unable to load dashboard</h2><p className="text-text-muted">Please refresh the page or try again later.</p></div></div>}>
    <Dashboard />
  </ErrorBoundary>
);

const AdminWithBoundary = () => (
  <ErrorBoundary fallback={<div className="min-h-screen flex items-center justify-center p-4"><div className="text-center"><h2 className="text-xl font-semibold mb-2">Unable to load admin panel</h2><p className="text-text-muted">Please refresh the page or try again later.</p></div></div>}>
    <AdminDashboard />
  </ErrorBoundary>
);

function App() {
  const [showPreloader, setShowPreloader] = useState(() => {
    try {
      return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!showPreloader) return undefined;
    const timeout = window.setTimeout(() => setShowPreloader(false), 12000);
    return () => window.clearTimeout(timeout);
  }, [showPreloader]);

  const handlePreloaderComplete = useCallback(() => {
    setShowPreloader(false);
    window.scrollTo(0, 0); // Reset scroll position for main app
  }, []);

  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || "fallback_client_id"}>
      <ThemeProvider>
        {showPreloader ? (
          <PageLoader onComplete={handlePreloaderComplete} />
        ) : (
          <AuthProvider>
            <ToastProvider>
              <Router>
                <SkipLink />
                <div className="min-h-screen bg-transparent transition-colors duration-300 animate-fade-in-up">
                  <ScrollProgress />
                  <Navbar />
                  <main id="main-content" tabIndex={-1} className="focus:outline-none">
                    <Suspense fallback={<SimpleLoader />}>
                      <Routes>
                        <Route path="/" element={<HomeWithBoundary />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/register" element={<Register />} />
                        <Route path="/dashboard" element={
                          <ProtectedRoute>
                            <DashboardWithBoundary />
                          </ProtectedRoute>
                        } />
                        <Route path="/unlock/:code" element={<Unlock />} />
                        <Route path="/bio/:slug" element={<BioView />} />
                        <Route path="/admin" element={
                          <ProtectedRoute adminOnly>
                            <AdminWithBoundary />
                          </ProtectedRoute>
                        } />
                      </Routes>
                    </Suspense>
                  </main>
                </div>
              </Router>
            </ToastProvider>
          </AuthProvider>
        )}
      </ThemeProvider>
    </GoogleOAuthProvider>
  );
}

export default App;