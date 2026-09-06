import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@wag/ui-web';

import '@wag/ui-web/styles.css';
import '@wag/ui-web/portal.css';

import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider surface="admin" baseUrl={import.meta.env.VITE_API_URL || 'http://localhost:4000'}>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
