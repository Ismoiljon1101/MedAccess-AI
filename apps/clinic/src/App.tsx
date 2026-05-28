import { Route, Routes } from 'react-router-dom';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import Interview from '@/pages/Interview';
import Symptoms from '@/pages/Symptoms';
import Reports from '@/pages/Reports';
import Triage from '@/pages/Triage';
import Patients from '@/pages/Patients';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/patients" element={<Patients />} />
        <Route path="/interview" element={<Interview />} />
        <Route path="/symptoms" element={<Symptoms />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/triage" element={<Triage />} />
        <Route path="*" element={<Home />} />
      </Route>
    </Routes>
  );
}
