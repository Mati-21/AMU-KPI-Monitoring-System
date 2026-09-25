import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { QueryClientProvider } from '@tanstack/react-query';

import './index.css';
import App from './App.jsx';
import { store } from './app/store.js';
import { queryClient } from './app/queryClient.js';
import { ThemeProvider } from './Context/ThemeContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </QueryClientProvider>
    </Provider>
  </StrictMode>
);
