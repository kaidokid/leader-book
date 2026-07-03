import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import UploadPage from '@/pages/Upload';
import SearchPage from '@/pages/Search';
import GeneratePage from '@/pages/Generate';
import ReportViewPage from '@/pages/ReportView';
import HistoryPage from '@/pages/History';
import SettingsPage from '@/pages/Settings';

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/generate/:jobId" element={<GeneratePage />} />
          <Route path="/report/:reportId" element={<ReportViewPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Layout>
    </Router>
  );
}
