import './demo.css';
import './lib/standard_light.css';
import './lib/standard_dark.css';
import './lib/retro.css';
import React from 'react';
import App from './App';
import { createRoot } from 'react-dom/client';



const root = createRoot(document.getElementById('app'));
root.render(
    <App />
);

