import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import Chat from '@/pages/Chat';
import EmergencyCheck from '@/pages/EmergencyCheck';
import Reports from '@/pages/Reports';
import History from '@/pages/History';
import Settings from '@/pages/Settings';
import VoiceMode from '@/pages/VoiceMode';
import FindCare from '@/pages/FindCare';
import MyRecords from '@/pages/MyRecords';
import Profile from '@/pages/Profile';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/"          element={<Chat />} />
          <Route path="/emergency" element={<EmergencyCheck />} />
          <Route path="/find-care" element={<FindCare />} />
          <Route path="/records"   element={<MyRecords />} />
          <Route path="/profile"   element={<Profile />} />
          <Route path="/reports"   element={<Reports />} />
          <Route path="/history"   element={<History />} />
          <Route path="/settings"  element={<Settings />} />
          <Route path="/voice"     element={<VoiceMode />} />
          {/* Legacy */}
          <Route path="/symptoms"  element={<Chat />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
