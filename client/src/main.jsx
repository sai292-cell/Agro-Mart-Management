import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app/App';
import './index.css';
// Initialize i18n
import './i18n/i18n';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
