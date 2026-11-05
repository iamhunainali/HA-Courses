import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth';
import { SettingsProvider } from './settings';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <SettingsProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </SettingsProvider>
  </BrowserRouter>
);
