import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import Chat from '@/pages/Chat';
import EmergencyCheck from '@/pages/EmergencyCheck';
import Reports from '@/pages/Reports';
import History from '@/pages/History';
import Settings from '@/pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/"          element={<Chat />} />
          <Route path="/emergency" element={<EmergencyCheck />} />
          <Route path="/reports"   element={<Reports />} />
          <Route path="/history"   element={<History />} />
          <Route path="/settings"  element={<Settings />} />
          {/* Legacy */}
          <Route path="/symptoms"  element={<Chat />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
