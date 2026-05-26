import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import Chat from '@/pages/Chat';
import EmergencyCheck from '@/pages/EmergencyCheck';
import Reports from '@/pages/Reports';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/"          element={<Chat />} />
          <Route path="/emergency" element={<EmergencyCheck />} />
          <Route path="/reports"   element={<Reports />} />
          {/* Legacy redirect — keep old /symptoms working */}
          <Route path="/symptoms"  element={<Chat />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
