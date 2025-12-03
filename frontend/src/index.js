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
