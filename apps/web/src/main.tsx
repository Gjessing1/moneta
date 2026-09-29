import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/schibsted-grotesk/wght.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/frame.css';
import './styles/screens.css';
import './styles/archive.css';
import { App } from './App';

const root = document.getElementById('root');
if (!root) {
  throw new Error('#root missing from index.html');
}
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
