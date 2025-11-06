import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import WellnessBuddyApp from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));

// ✅ ANDROID PERFORMANCE: Disable StrictMode in production for faster rendering
if (process.env.NODE_ENV === 'production') {
  root.render(<WellnessBuddyApp />);
} else {
  root.render(
    <React.StrictMode>
      <WellnessBuddyApp />
    </React.StrictMode>
  );
}
