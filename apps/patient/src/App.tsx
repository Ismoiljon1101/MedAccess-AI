import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import Chat from '@/pages/Chat';
import EmergencyCheck from '@/pages/EmergencyCheck';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/"          element={<Chat />} />
          <Route path="/emergency" element={<EmergencyCheck />} />
          {/* Legacy redirect — keep old /symptoms working */}
          <Route path="/symptoms"  element={<Chat />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
