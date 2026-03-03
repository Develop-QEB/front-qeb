import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css';
import './index.css'
import App from './App.tsx'

// Apply saved theme before first render to avoid flash
try {
  const stored = JSON.parse(localStorage.getItem('theme-storage') || '{}');
  if (stored?.state?.theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
} catch { /* ignore */ }

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
