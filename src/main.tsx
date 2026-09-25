import {ErrorBoundary} from './components/ErrorBoundary';
import {StrictMode,Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary><Suspense fallback={<div role="status" className="p-10 text-center">Đang tải phân hệ…</div>}><App /></Suspense></ErrorBoundary>
  </StrictMode>,
);
