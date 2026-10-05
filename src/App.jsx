import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { TenantProvider } from './context/TenantContext';
import { LanguageProvider } from './context/LanguageContext';
import AppRoutes from './routes/AppRoutes';

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <TenantProvider>
            <AppRoutes />
          </TenantProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
