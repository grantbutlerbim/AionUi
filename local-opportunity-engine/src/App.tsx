import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import AppShell from '@/components/AppShell';
import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import ImportCsv from '@/pages/ImportCsv';
import PropertyDetail from '@/pages/PropertyDetail';
import Contractors from '@/pages/Contractors';
import Campaigns from '@/pages/Campaigns';

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/import" element={<ImportCsv />} />
          <Route path="/properties/:id" element={<PropertyDetail />} />
          <Route path="/contractors" element={<Contractors />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
