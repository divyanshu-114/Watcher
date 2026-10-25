// Renderer entry point: load saved data, start the focus timer, then render the React app
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { load } from './lib/store.js';
import { startFocusEngine } from './lib/focus.js';
import { toast } from './lib/toast.js';
import './styles.css';

const { firstRun, migrated } = await load();
startFocusEngine();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);

if (migrated) toast('Your tasks from the previous version were brought over.');
else if (firstRun) toast('Welcome! Some example tasks are here to show you around.');
