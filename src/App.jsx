import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { TenantProvider } from './context/TenantContext';
import { LanguageProvider } from './context/LanguageContext';
import AppRoutes from './routes/AppRoutes';
import ErrorBoundary from './components/shared/ErrorBoundary';

export default function App() {
  return (
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <TenantProvider>
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </TenantProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}
