import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import SymptomCheck from '@/pages/SymptomCheck';
import EmergencyCheck from '@/pages/EmergencyCheck';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/symptoms" element={<SymptomCheck />} />
          <Route path="/emergency" element={<EmergencyCheck />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
