import { Route, Routes, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Patients from '@/pages/Patients';
import Prescriptions from '@/pages/Prescriptions';
import Profile from '@/pages/Profile';
import Settings from '@/pages/Settings';

// Role-based guard — unauthenticated users see Login
function AuthGuard({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// Role guard — wrong role redirects to dashboard
function RoleGuard({ allow, children }: { allow: string[]; children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user || !allow.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  const user = useAuthStore((s) => s.user);

  return (
    <Routes>
      {/* Public */}
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <Login />}
      />

      {/* Protected — all inside Layout (sidebar) */}
      <Route
        element={
          <AuthGuard>
            <Layout />
          </AuthGuard>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />

        {/* Doctor + Admin */}
        <Route
          path="/patients"
          element={
            <RoleGuard allow={['doctor', 'admin']}>
              <Patients />
            </RoleGuard>
          }
        />

        {/* Pharmacist */}
        <Route
          path="/prescriptions"
          element={
            <RoleGuard allow={['pharmacist', 'admin']}>
              <Prescriptions />
            </RoleGuard>
          }
        />

        {/* All roles */}
        <Route path="/profile"  element={<Profile />} />
        <Route path="/settings" element={<Settings />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>

      {/* Root redirect */}
      <Route path="/" element={<Navigate to={user ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}
