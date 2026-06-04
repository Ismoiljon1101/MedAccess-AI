import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from '@/components/Layout';
import Welcome from '@/pages/Welcome';
import Chat from '@/pages/Chat';
import EmergencyCheck from '@/pages/EmergencyCheck';
import Settings from '@/pages/Settings';
import VoiceMode from '@/pages/VoiceMode';
import FindCare from '@/pages/FindCare';
import MyRecords from '@/pages/MyRecords';
import Profile from '@/pages/Profile';
import { useAppStore } from '@/store/app';

function AppRoutes() {
  const { patientProfile, theme } = useAppStore();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  if (!patientProfile) {
    return <Welcome />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/"          element={<Chat />} />
        <Route path="/emergency" element={<EmergencyCheck />} />
        <Route path="/find-care" element={<FindCare />} />
        <Route path="/records"   element={<MyRecords />} />
        <Route path="/profile"   element={<Profile />} />
        <Route path="/settings"  element={<Settings />} />
        <Route path="/voice"     element={<VoiceMode />} />
        {/* Legacy redirects */}
        <Route path="/symptoms"  element={<Navigate to="/" replace />} />
        <Route path="/history"   element={<Navigate to="/records" replace />} />
        <Route path="/reports"   element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
