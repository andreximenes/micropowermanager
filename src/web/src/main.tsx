import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { registerHeadingFont } from '@/lib/headingFont';
import { createAppRouter } from '@/router';
import '@/styles.css';

// Password reset e-mails still link to the legacy hash route (/#/reset-password?token=…).
if (window.location.hash.startsWith('#/reset-password')) {
  window.history.replaceState(null, '', window.location.hash.slice(1));
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});
const router = createAppRouter(queryClient);

registerHeadingFont(import.meta.env.VITE_HEADING_FONT_URL);

const root = document.getElementById('root');
if (!root) {
  throw new Error('Missing #root element');
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
