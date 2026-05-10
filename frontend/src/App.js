import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import StudentDashboard from '@/pages/StudentDashboard';
import VotePage from '@/pages/VotePage';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminElections from '@/pages/admin/AdminElections';
import AdminElectionDetail from '@/pages/admin/AdminElectionDetail';
import AdminVoters from '@/pages/admin/AdminVoters';
import AdminResults from '@/pages/admin/AdminResults';
import OfflineBanner from '@/components/OfflineBanner';
import '@/App.css';

function Protected({ children, role }) {
  const { user } = useAuth();
  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground" data-testid="auth-loading">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (role === 'admin' && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  if (role === 'student' && user.role !== 'student') return <Navigate to="/admin" replace />;
  return children;
}

function HomeRedirect() {
  const { user } = useAuth();
  if (user === undefined) return null;
  if (!user) return <Landing />;
  return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
}

export default function App() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const onChange = () => setTick((n) => n + 1);
    window.addEventListener('online', onChange);
    window.addEventListener('offline', onChange);
    return () => {
      window.removeEventListener('online', onChange);
      window.removeEventListener('offline', onChange);
    };
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <OfflineBanner />
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Protected role="student"><StudentDashboard /></Protected>} />
          <Route path="/vote/:electionId" element={<Protected role="student"><VotePage /></Protected>} />
          <Route path="/admin" element={<Protected role="admin"><AdminDashboard /></Protected>} />
          <Route path="/admin/elections" element={<Protected role="admin"><AdminElections /></Protected>} />
          <Route path="/admin/elections/:electionId" element={<Protected role="admin"><AdminElectionDetail /></Protected>} />
          <Route path="/admin/voters" element={<Protected role="admin"><AdminVoters /></Protected>} />
          <Route path="/admin/results" element={<Protected role="admin"><AdminResults /></Protected>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster richColors position="top-center" />
      </BrowserRouter>
    </AuthProvider>
  );
}
