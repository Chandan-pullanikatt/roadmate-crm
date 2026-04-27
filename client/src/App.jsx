import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';

// Lazy loaded dashboards
const FounderDashboard = lazy(() => import('./pages/founder/FounderDashboard'));
const StateDashboard = lazy(() => import('./pages/state-manager/StateDashboard'));
const IndDashboard = lazy(() => import('./pages/industry-manager/IndDashboard'));
const ExecutiveDashboard = lazy(() => import('./pages/executive/ExecutiveDashboard'));
const Login = lazy(() => import('./pages/Login'));

const Forbidden = () => (
  <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-center p-8">
    <div>
      <h1 className="text-6xl font-bold text-[var(--red)] mb-4">403</h1>
      <h2 className="text-2xl font-semibold mb-2">Access Denied</h2>
      <p className="text-[var(--text-secondary)] mb-6">You don't have permission to view this page.</p>
      <button 
        onClick={() => window.history.back()}
        className="px-6 py-2 bg-[var(--accent)] text-white rounded-[var(--radius)]"
      >
        Go Back
      </button>
    </div>
  </div>
);

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--accent)]"></div>
    </div>
  );

  if (!isAuthenticated) return <Navigate to="/login" />;
  
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/403" />;
  }

  return children;
};

const DashboardSwitcher = () => {
  const { user } = useAuth();
  
  const renderDashboard = () => {
    switch (user.role) {
      case 'founder': return <Layout><FounderDashboard /></Layout>;
      case 'state_manager': return <StateDashboard />;
      case 'industry_manager': return <Layout><IndDashboard /></Layout>;
      case 'executive': return <Layout><ExecutiveDashboard /></Layout>;
      default: return <Navigate to="/login" />;
    }
  };

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--accent)]"></div>
      </div>
    }>
      {renderDashboard()}
    </Suspense>
  );
};

import { Toaster } from 'react-hot-toast';

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Router>
      <Toaster position="top-right" reverseOrder={false} />
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--accent)]"></div>
        </div>
      }>
        <Routes>
          <Route 
            path="/login" 
            element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login />} 
          />
          
          <Route path="/403" element={<Forbidden />} />
          
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <DashboardSwitcher />
              </ProtectedRoute>
            } 
          />

          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
