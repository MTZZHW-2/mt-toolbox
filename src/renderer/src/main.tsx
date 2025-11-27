import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import { Toaster } from '@renderer/components/base/sonner';
import App from './App';
import '@renderer/styles/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
      <Toaster position="top-right" richColors />
    </HashRouter>
  </StrictMode>,
);
