import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@aws-amplify/ui-react/styles.css';
import './index.css';
import { App } from './App';
import { configureAmplify } from './lib/amplify';

async function bootstrap() {
  await configureAmplify();
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>,
  );
}

void bootstrap();
