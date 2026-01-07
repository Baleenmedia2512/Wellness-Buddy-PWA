import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import WellnessValleyApp from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));

// ✅ ANDROID PERFORMANCE: Disable StrictMode in production for faster rendering
if (process.env.NODE_ENV === 'production') {
  root.render(<WellnessValleyApp />);
} else {
  root.render(
    <React.StrictMode>
      <WellnessValleyApp />
    </React.StrictMode>
  );
}

// ✅ PWA: Register service worker
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('✅ [PWA] Service Worker registered:', registration.scope);
        
        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60000); // Check every minute
      })
      .catch((error) => {
        console.warn('⚠️ [PWA] Service Worker registration failed:', error);
      });
  });
}
